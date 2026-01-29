import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserProfile } from "./ProfileCard";
import { User, Save, X } from "lucide-react";
// Removed profileService import - we'll use UserContext directly
import SignaturePad, { SignaturePadRef } from "@/components/SignaturePad";
import { useToast } from "@/hooks/useToast";
import LoadingAnimation from "@/components/LoadingAnimation";
import apiService from "@/lib/apiService";
import { dataURLtoFile } from "../utils/data-url-to-file";

import { useAuth } from "@/contexts/UserContext";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: (updatedProfile: UserProfile | null) => void;
}

interface Account {
  username?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
  signature?: string | null;
}

export default function ProfileModal({
  isOpen,
  onClose,
  profile,
  onSave,
}: ProfileModalProps) {
  const [formData, setFormData] = useState<Account | null>({
    username: "",
    email: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
    signature: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { success } = useToast();
  const { refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const initializedProfileIdRef = useRef<string | number | null>(null); // Track which profile ID we've initialized
  const initialValuesRef = useRef<{ username?: string; email?: string } | null>(null); // Track initial values for comparison
  
  // Reset form data when modal opens or profile changes
  useEffect(() => {
    // Only initialize when modal opens and we haven't initialized yet, or when profile ID changes
    if (isOpen && profile?.id) {
      // Check if this is a different profile or first time opening
      if (initializedProfileIdRef.current !== profile.id) {
        setFormData((prev) => ({
          ...prev,
          username: profile?.username || "",
          email: profile?.email || "",
        }));
        // Store initial values for comparison (to detect if user changed them)
        initialValuesRef.current = {
          username: profile?.username || "",
          email: profile?.email || "",
        };
        initializedProfileIdRef.current = profile.id; // Store profile ID to track changes
      }
    }
    
    // Reset initialization flag when modal closes
    if (!isOpen) {
      initializedProfileIdRef.current = null;
      initialValuesRef.current = null;
    }
  }, [isOpen, profile?.id, profile?.username, profile?.email]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Check if user is trying to update username, email, or password
    // Compare against initial values (when modal opened) not current profile values
    const initialUsername = initialValuesRef.current?.username || profile?.username || "";
    const initialEmail = initialValuesRef.current?.email || profile?.email || "";
    
    const isUpdatingUsername = formData?.username && formData.username.trim() !== "" && formData.username !== initialUsername;
    const isUpdatingEmail = formData?.email && formData.email.trim() !== "" && formData.email !== initialEmail;
    const isUpdatingPassword = formData?.new_password && formData.new_password.trim() !== "";

    // Require current password if updating username, email, or password
    if ((isUpdatingUsername || isUpdatingEmail || isUpdatingPassword) && 
        (!formData?.current_password || formData.current_password.trim() === "")) {
      newErrors.current_password = "Current password is required to update account information";
    }

    if (formData?.new_password && String(formData?.new_password).length < 8) {
      newErrors.new_password = "Password must be at least 8 characters";
    } else if (
      formData?.new_password &&
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.new_password)
    ) {
      newErrors.new_password =
        "Password must contain uppercase, lowercase, and number";
    }

    if (
      formData?.confirm_password &&
      String(formData?.confirm_password).length < 8
    ) {
      newErrors.confirm_password = "Password must be at least 8 characters";
    } else if (
      formData?.confirm_password &&
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.confirm_password)
    ) {
      newErrors.confirm_password =
        "Password must contain uppercase, lowercase, and number";
    }

    // Validate that new password and confirm password match
    if (formData?.new_password && formData?.confirm_password) {
      if (formData.new_password !== formData.confirm_password) {
        newErrors.confirm_password = "Passwords do not match";
      }
    }

    if (
      formData?.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData?.email)
    ) {
      newErrors.email = "Please enter a valid email address";
    }

    // Signature validation - only require signature if there's no existing signature in profile
    // Allow form submission if user already has a signature (even if they're not changing it)
    const hasExistingSignature = profile?.signature && 
      typeof profile.signature === 'string' && 
      profile.signature.trim() !== "" && 
      profile.signature !== "null" &&
      profile.signature !== "undefined";
    
    if (!hasExistingSignature) {
      // Only validate signature if user doesn't have one already
      const currentSignature = signaturePadRef.current?.getSignature() || formData?.signature || null;
      // Check if signature is valid (not null, not empty string, not just whitespace)
      if (!currentSignature || 
          (typeof currentSignature === 'string' && currentSignature.trim() === "") ||
          currentSignature === "null" ||
          currentSignature === "undefined") {
        newErrors.signature = "Digital signature is required";
      }
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid) {
      console.log("Validation errors:", newErrors);
    }
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submission started");

    if (!validateForm()) {
      console.log("Validation failed, not submitting");
      return;
    }

    console.log("Validation passed, proceeding with submission");
    setIsLoading(true);
    try {
      // Add a small delay to show the loading animation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const formDataToUpload = new FormData();
      formDataToUpload.append("username", formData?.username || "");
      formDataToUpload.append("email", formData?.email || "");
      formDataToUpload.append(
        "current_password",
        formData?.current_password || ""
      );
      formDataToUpload.append("new_password", formData?.new_password || "");
      formDataToUpload.append(
        "confirm_password",
        formData?.confirm_password || ""
      );
      // Get the current signature from SignaturePad (may be local, not in formData yet)
      const currentSignature = signaturePadRef.current?.getSignature() || formData?.signature || profile?.signature || null;
      console.log("Current signature:", currentSignature ? "exists" : "null");

      if (currentSignature) {
        // Check if it's a data URL (newly drawn signature) or a server URL (existing signature)
        if (typeof currentSignature === 'string' && currentSignature.startsWith('data:')) {
          // It's a data URL - convert to File
          const signature = dataURLtoFile(currentSignature, "signature.png");
          if (signature) {
            formDataToUpload.append("signature", signature);
            console.log("Signature file appended to FormData");
          } else {
            console.warn("Failed to convert signature data URL to File");
          }
        } else if (typeof currentSignature === 'string' && 
                   (currentSignature.startsWith('http://') || 
                    currentSignature.startsWith('https://') || 
                    currentSignature.startsWith('/'))) {
          // It's a server URL - signature hasn't changed, don't send it
          // Backend will keep the existing signature
          console.log("Signature is from server (unchanged), not sending");
        } else {
          // Unknown format, try to convert anyway
          console.warn("Unknown signature format, attempting conversion");
          const signature = dataURLtoFile(currentSignature, "signature.png");
          if (signature) {
            formDataToUpload.append("signature", signature);
          }
        }
      } else {
        // If no signature, don't append anything (let backend handle it)
        console.log("No signature to append");
      }

      console.log("Calling updateEmployee_auth API...");
      await apiService.updateEmployee_auth(formDataToUpload);
      console.log("API call successful");

      // Show success toast
      success("Profile updated successfully!");

      // Update initial values to the newly saved values
      // This ensures that if user makes another change, it will require password again
      if (formData?.username || formData?.email) {
        initialValuesRef.current = {
          username: formData.username || initialValuesRef.current?.username || "",
          email: formData.email || initialValuesRef.current?.email || "",
        };
      }

      // Clear password fields after successful save
      setFormData((prev) => ({
        ...prev,
        current_password: "",
        new_password: "",
        confirm_password: "",
      }));

      // Refresh user profile to get updated data (only once, after successful save)
      // Use a small delay to ensure the API has processed the update
      setTimeout(() => {
        refreshUser();
      }, 100);
      
      // Reset initialization flag so form reloads with new data next time
      initializedProfileIdRef.current = null;
      onClose();

      // Close modal after a brief delay to ensure state is updated
    } catch (error: any) {
      console.error("Error updating profile:", error);
      console.error("Error response:", error?.response);
      console.error("Error message:", error?.message);
      setOpen(true);
      
      // Handle different error structures
      if (error?.response?.data?.errors) {
        const backendErrors: Record<string, string> = {};

        Object.keys(error.response.data.errors).forEach((field) => {
          const fieldErrors = error.response.data.errors[field];
          if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
            backendErrors[field] = fieldErrors[0];
          } else if (typeof fieldErrors === 'string') {
            backendErrors[field] = fieldErrors;
          }
        });
        setErrors(backendErrors);
      } else {
        // Show general error if no specific field errors
        const errorMessage = error?.response?.data?.message || 
                           error?.message || 
                           error?.toString() || 
                           "Failed to update profile. Please try again.";
        setErrors((prev) => ({
          ...prev,
          general: errorMessage,
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Don't refresh user on cancel - it's unnecessary and can cause re-renders
    // The profile prop will already have the latest data
    setErrors({});
    // Reset initialization flag so form reloads with fresh data next time
    initializedProfileIdRef.current = null;
    onClose();
  };

  const handleRequestReset = async () => {
    try {
      setIsLoading(true);
      await apiService.requestSignatureReset();
      // After successful reset request, wait for admin approval
      // Don't enable Clear Signature yet - user must wait for approval
      success(
        "Signature reset request submitted successfully! Please wait for admin approval. You will be able to clear your signature once approved."
      );
      // Refresh user after a small delay to get updated requestSignatureReset status
      // This is needed for the SignaturePad polling to work correctly
      setTimeout(() => {
        refreshUser();
      }, 100);
    } catch (error: any) {
      console.error("Error requesting signature reset:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to request signature reset. Please try again.";
      setErrors((prev) => ({
        ...prev,
        general: errorMessage,
      }));
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChangeAction={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto px-6 py-6 animate-popup">
        {/* Sticky Cancel and Save Buttons - Stay at top when scrolling */}
        <div className="sticky top-0 z-50 flex justify-end gap-2 mb-4 -mr-6 pr-6 py-4 no-print">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 hover:text-white text-white cursor-pointer hover:scale-110 transition-transform duration-200 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <X className="w-5 h-5 text-white" />
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isLoading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 cursor-pointer hover:scale-110 transition-transform duration-200 shadow-lg hover:shadow-xl transition-all duration-300"
            onClick={handleSubmit}
          >
            {isLoading ? (
              <>
                <LoadingAnimation size="sm" variant="spinner" color="white" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>

        <DialogHeader className="px-1 ">
          <DialogTitle className="flex items-center gap-2 text-xl bg-blue-200 px-3 py-2 rounded-lg">
            <User className="w-5 h-5" />
            Edit Profile
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-0">
          {/* Avatar Section */}
          <div className="flex flex-col mt-7 items-center space-y-4">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
                <img
                  src="/user.png"
                  alt={profile?.fname[0] || "Profile"}
                  className="h-25 w-25 rounded-full object-cover"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mt-10">
              This fields is read only :
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="fname" className="text-sm font-medium">
                  First Name
                </Label>
                <Input id="fname" value={profile?.fname} readOnly />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lname" className="text-sm font-medium">
                  Last Name
                </Label>
                <Input id="lname" value={profile?.lname} readOnly />
              </div>

              {/* Contact */}
              <div className="space-y-1.5">
                <Label htmlFor="contact" className="text-sm font-medium">
                  Contact
                </Label>
                <Input
                  id="contact"
                  type="number"
                  value={profile?.contact || ""}
                  readOnly
                />
              </div>

              {/* Role/Position */}
              {profile?.roles[0].name !== "admin" && (
                <>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="roleOrPosition"
                      className="text-sm font-medium"
                    >
                      Position
                    </Label>
                    <Input
                      value={profile?.positions?.label || "Not Assigned "}
                      readOnly
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="department" className="text-sm font-medium">
                      Department
                    </Label>
                    <Input
                      value={
                        profile?.departments?.department_name || "Not Assigned "
                      }
                      readOnly
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="branch" className="text-sm font-medium">
                      Branch
                    </Label>
                    <Input
                      value={
                        profile?.branches[0]?.branch_name || "Not Assigned "
                      }
                      readOnly
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <p
              className="text-sm text-blue-700 mt-10 cursor-pointer"
              onClick={() => setOpen(!open)}
            >
              Edit Account Settings ...
            </p>

            <div
              className={`${
                open ? "max-h-[30vh]" : "max-h-0"
              } overflow-hidden transition-all duration-400 mt-2`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-sm font-medium">
                    Username
                  </Label>
                  <Input
                    id="username"
                    value={formData?.username || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        username: e.target.value,
                      })
                    }
                  />
                  {errors.username && (
                    <p className="text-sm text-red-500">{errors.username}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    value={formData?.email || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email: e.target.value,
                      })
                    }
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                </div>

                {/* Current Password */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Current Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="current_password"
                    type="password"
                    placeholder="******"
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        current_password: e.target.value,
                      });
                      // Clear error when user starts typing
                      if (errors.current_password) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.current_password;
                          return newErrors;
                        });
                      }
                    }}
                  />
                  {errors.current_password && (
                    <p className="text-sm text-red-500">
                      {errors.current_password}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Required when updating username, email, or password
                  </p>
                </div>

                {/* New Password */}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">New Password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    placeholder="******"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        new_password: e.target.value,
                      })
                    }
                  />
                  {errors.new_password && (
                    <p className="text-sm text-red-500">
                      {errors.new_password}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    placeholder="******"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirm_password: e.target.value,
                      })
                    }
                  />
                  {errors.confirm_password && (
                    <p className="text-sm text-red-500">
                      {errors.confirm_password}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Digital Signature */}
          <Label htmlFor="signature" className="text-sm font-medium">
            Digital Signature{" "}
          </Label>
          <div className="space-y-2">
            <SignaturePad
              ref={signaturePadRef}
              value={profile?.signature || formData?.signature || null}
              onChangeAction={(signature) => {
                // Only update formData when signature is cleared (null)
                // For new signatures, they're stored locally until Save is clicked
                if (signature === null) {
                  setFormData({ ...formData, signature: null });
                }
                // Clear signature error when user starts drawing
                if (signature && errors.signature) {
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.signature;
                    return newErrors;
                  });
                }
              }}
              className="w-full"
              required={true}
              hasError={!!errors.signature}
              onRequestReset={handleRequestReset}
            />
            {errors.signature && (
              <p className="text-sm text-red-500">{errors.signature}</p>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Update your digital signature for official documents and approvals.
            
           
          </p>
          <p className="text-sm text-gray-700"><span className="font-bold">Note:</span> If you are unsure about your new signature, 
          please do not click Save yet. Clearing your signature will reset it to the default signature</p>

          {/* General Error */}
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

        </form>
      </DialogContent>
    </Dialog>
  );
}
