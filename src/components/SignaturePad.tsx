"use client";

import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { dataURLtoFile } from "@/utils/data-url-to-file";
import Image from "next/image";
import { CONFIG } from "../../config/config";
import { User, PenTool, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/UserContext";

interface SignaturePadProps {
  value: string | null;
  onChangeAction: (signature: File | any) => void;
  className?: string;
  required?: boolean;
  hasError?: boolean;
  onRequestReset?: () => void;
  hideRequestReset?: boolean; // Hide the "Request Reset" button
  /** Lock parent scroll / pin pad while user is drawing (mobile-friendly). */
  onDrawingActiveChange?: (isDrawing: boolean) => void;
}

export interface SignaturePadRef {
  getSignature: () => string | null;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(({
  value,
  onChangeAction,
  className = "",
  required = false,
  hasError = false,
  onRequestReset,
  hideRequestReset = false,
  onDrawingActiveChange,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>("");
  const [isSavedSignature, setIsSavedSignature] = useState(false); // Track if signature is from server (saved)
  const [lastDrawnSignature, setLastDrawnSignature] = useState<string | null>(
    null
  ); // Track the last drawn signature (data URL)
  const [localSignature, setLocalSignature] = useState<string | null>(null); // Store signature locally until save
  const [hasDrawingOnCanvas, setHasDrawingOnCanvas] = useState(false); // Track if there's drawing on canvas (not yet captured)
  const [showInstructions, setShowInstructions] = useState(true); // Show instructions overlay before drawing
  const [showContactDeveloperDialog, setShowContactDeveloperDialog] = useState(false);
  const { user } = useAuth();
  // Note: Polling for signature reset approval is now handled globally in UserContext
  // to prevent multiple intervals from multiple SignaturePad instances

  // Expose method to get current signature
  useImperativeHandle(ref, () => ({
    getSignature: () => {
      // If there's a saved local signature, return it
      if (localSignature) {
        return localSignature;
      }
      
      // If there's drawing on canvas, capture it now (on-demand capture)
      if (hasDrawingOnCanvas) {
        const canvas = canvasRef.current;
        if (canvas) {
          const dataURL = canvas.toDataURL("image/png");
          return dataURL;
        }
      }
      
      // Otherwise return value prop (saved signature from server)
      return value || null;
    }
  }));
  // Helper function to get coordinates
  const getCoordinates = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Load existing signature when value changes (from parent/prop)
  useEffect(() => {
    // Only sync from parent value if we don't have a local signature
    // This prevents overwriting locally drawn signatures
    if (localSignature) {
      // We have a local signature, use it for preview
      return;
    }

    console.log("SignaturePad value changed:", value);
    if (value && typeof value === "string" && value.trim() !== "") {
      // If there's an existing signature, hide instructions
      setShowInstructions(false);
      let imageUrl = "";
      let isFromServer = false;

      // Check if it's a URL path (from server) or data URL (base64)
      if (value.startsWith("http://") || value.startsWith("https://")) {
        // It's a full URL - from server (saved)
        imageUrl = value;
        isFromServer = true;
      } else if (value.startsWith("/")) {
        // It's a path starting with / - from server (saved)
        imageUrl = CONFIG.API_URL_STORAGE + value;
        isFromServer = true;
      } else if (value.startsWith("data:")) {
        // It's a data URL (base64) - newly drawn, not saved yet
        imageUrl = value;
        isFromServer = false;
        setLastDrawnSignature(value); // Track this as the drawn signature
      } else {
        // It's likely a file path without leading slash - from server (saved)
        imageUrl = CONFIG.API_URL_STORAGE + "/" + value;
        isFromServer = true;
      }

      // If value changed from data URL to server path, it means it was just saved
      if (
        isFromServer &&
        (lastDrawnSignature?.startsWith("data:") || localSignature || hasDrawingOnCanvas)
      ) {
        console.log("Signature was just saved! Marking as saved.");
        setIsSavedSignature(true);
        setLastDrawnSignature(null); // Clear the drawn signature since it's now saved
        setLocalSignature(null); // Clear local signature since it's now saved
        setHasDrawingOnCanvas(false); // Clear drawing state since it's now saved
      } else {
        setIsSavedSignature(isFromServer);
      }

      console.log(
        "Setting signature image URL:",
        imageUrl,
        "isSaved:",
        isFromServer
      );
      setPreviewImage(imageUrl);
      setHasSignature(true);
    } else if (!value || value === null || value === "") {
      // No signature, reset state (only if no local signature and no drawing on canvas)
      if (!localSignature && !hasDrawingOnCanvas) {
        console.log("No signature value, resetting");
        setHasSignature(false);
        setPreviewImage("");
        setIsSavedSignature(false);
        setLastDrawnSignature(null);
        setHasDrawingOnCanvas(false);
      }
    }
  }, [value, lastDrawnSignature, localSignature]);

  // Update preview when localSignature changes
  useEffect(() => {
    if (localSignature) {
      setPreviewImage(localSignature);
      setHasSignature(true);
      setIsSavedSignature(false);
    }
  }, [localSignature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    onDrawingActiveChange?.(isDrawing);
  }, [isDrawing, onDrawingActiveChange]);

  useEffect(() => {
    if (!isDrawing || typeof document === "undefined") return;

    const scrollHost =
      (canvasRef.current?.closest(
        "[data-signature-scroll-host]"
      ) as HTMLElement | null) ??
      (canvasRef.current?.closest(".overflow-y-auto") as HTMLElement | null);

    const prevOverflow = scrollHost?.style.overflow ?? "";

    if (scrollHost) {
      scrollHost.style.overflow = "hidden";
    }

    return () => {
      if (scrollHost) {
        scrollHost.style.overflow = prevOverflow;
      }
    };
  }, [isDrawing]);

  // Handle instruction confirmation
  const handleConfirmInstructions = () => {
    setShowInstructions(false);
  };

  // Start drawing: press and hold to draw
  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (showInstructions) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || showInstructions) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (
    e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;

    if (e) {
      e.preventDefault();
    }

    setIsDrawing(false);
    
    // Mark that there's drawing on canvas (but don't capture yet - wait for Save)
    // Check if canvas has any drawing by checking if it's not empty
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imageData.data.some((channel, index) => {
          // Check alpha channel (every 4th value) - if any pixel is not transparent
          return index % 4 === 3 && channel > 0;
        });
        
        if (hasContent) {
          setHasDrawingOnCanvas(true);
          setHasSignature(true);
          setIsSavedSignature(false); // Newly drawn signature, not saved yet
        }
      }
    }
  };

  const clearSignature = () => {
    setLocalSignature(null);
    setHasSignature(false);
    setIsSavedSignature(false);
    setPreviewImage("");
    setLastDrawnSignature(null);
    setHasDrawingOnCanvas(false);
    onChangeAction(null); // Notify parent that signature is cleared

    // Small delay to ensure canvas is rendered before resetting
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 0);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        className={`relative touch-none overscroll-contain rounded-lg border-2 border-dashed bg-gray-50 p-4 ${
          hasError ? "border-red-300 bg-red-50" : "border-gray-300"
        }`}
      >
         {/* Instructions Overlay */}
         {showInstructions && !hasSignature && !isSavedSignature && (
           <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-lg z-10 flex flex-col items-center justify-center p-6 border-2 border-blue-200 shadow-lg">
             <div className="text-center space-y-4 max-w-sm">
               <div className="flex justify-center">
                 <div className="p-3 bg-blue-100 rounded-full">
                   <PenTool className="h-8 w-8 text-blue-600" />
                 </div>
               </div>
               <div>
                 <h3 className="text-lg font-semibold text-gray-800 mb-2">
                   How to Draw Your Signature
                 </h3>
                 <p className="text-sm text-gray-600 leading-relaxed">
                   Press and hold to draw your signature. Release to finish.
                 </p>
               </div>
               <Button
                 onClick={handleConfirmInstructions}
                 className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 cursor-pointer hover:to-blue-800 text-white px-6 py-2 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 font-semibold"
               >
                 <CheckCircle className="h-4 w-4 mr-2" />
                 Got it, let's start!
               </Button>
             </div>
           </div>
         )}

         {/* Show image preview only for saved signatures from server, keep canvas visible for in-progress drawings */}
         {hasSignature && isSavedSignature && (previewImage || localSignature) && !hasDrawingOnCanvas ? (
          <div className="w-full h-40 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden">
            <img
              src={localSignature || previewImage}
              alt="Signature"
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                console.error("Signature image failed to load:", localSignature || previewImage);
                // If image fails to load, reset signature state
                setHasSignature(false);
                setPreviewImage("");
                setLocalSignature(null);
              }}
            />
          </div>
        ) : (
           <canvas
             ref={canvasRef}
             className={`w-full h-40 cursor-crosshair bg-white rounded border ${
               hasError ? "border-red-300" : "border-gray-200"
             } ${showInstructions ? "cursor-not-allowed opacity-50" : "cursor-crosshair"}`}
             style={{ display: "block", touchAction: "none" }}
             onMouseDown={showInstructions ? undefined : startDrawing}
             onMouseMove={showInstructions ? undefined : draw}
             onMouseUp={showInstructions ? undefined : stopDrawing}
             onMouseLeave={showInstructions ? undefined : () => stopDrawing()}
             onTouchStart={showInstructions ? undefined : startDrawing}
             onTouchMove={showInstructions ? undefined : draw}
             onTouchEnd={showInstructions ? undefined : stopDrawing}
           />
        )}

        <p
          className={`text-sm mt-2 text-center ${
            hasError
              ? "text-red-600"
              : hasSignature && isSavedSignature
              ? "text-green-600"
              : hasDrawingOnCanvas
              ? "text-blue-600"
              : "text-gray-500"
          }`}
        >
          {hasError
            ? "⚠️ Signature is required"
            : hasSignature && isSavedSignature
            ? "Signature saved ✓"
            : hasDrawingOnCanvas
            ? "Signature ready - Click Save to capture"
            : required
            ? "Please draw your signature above *"
            : "Draw your signature above"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                  disabled={
                    hasSignature && isSavedSignature && user?.approvedSignatureReset === 0
                  }
                  className="text-white border-red-300 hover:text-white bg-red-600 hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                >
                  Clear Signature
                </Button>
              </span>
            </TooltipTrigger>
            {hasSignature && isSavedSignature && user?.approvedSignatureReset === 0 && (
              <TooltipContent>
                <p>Needs request for reset</p>
              </TooltipContent>
            )}
          </Tooltip>

          {!hideRequestReset && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={user?.requestSignatureReset !== 0}
                    size="sm"
                    onClick={() => {
                      if (onRequestReset) {
                        onRequestReset();
                      }
                      setShowContactDeveloperDialog(true);
                    }}
                    className="text-orange-600 bg-orange-500 text-white border-orange-300 hover:text-white hover:bg-orange-600 cursor-pointer disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                  >
                    Request Reset
                  </Button>
                </span>
              </TooltipTrigger>
              {user?.requestSignatureReset !== 0 && (
                <TooltipContent>
                  <p>Wait for admin to approve</p>
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </div>

        {hasSignature && (
          <div className={`text-sm flex items-center ${
            isSavedSignature ? "text-green-600" : "text-blue-600"
          }`}>
            <svg
              className="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {isSavedSignature ? "Signature Saved" : "Signature Ready - Click Save to capture"}
          </div>
        )}
      </div>

      {/* Contact Developer Dialog */}
      <Dialog
        open={showContactDeveloperDialog}
        onOpenChangeAction={(open) => {
          setShowContactDeveloperDialog(open);
        }}
      >
        <DialogContent 
          className="max-w-lg p-0 overflow-hidden border-0 shadow-2xl"
          style={{
            backgroundImage: 'url(/smct.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Header Section with Gradient */}
          <div className="relative px-6 pt-6 pb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800"></div>
            <DialogHeader className="relative z-10 pb-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg">
                  <img
                    src="/code.png"
                    alt="Developer Icon"
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <DialogTitle className="text-2xl font-bold text-white">
                  Contact Developer
                </DialogTitle>
              </div>
            </DialogHeader>
          </div>

          {/* Content Section */}
          <div className="bg-white px-6 pb-6 pt-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <img
                    src="/code.png"
                    alt="Developer Icon"
                    className="h-5 w-5 object-contain"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    You can contact the developer for the request. To contact, click the{" "}
                    <span className="font-semibold text-blue-600">developer icon</span> at the{" "}
                    <span className="font-semibold text-blue-600">bottom right</span> of the page.
                  </p>
                </div>
              </div>

              {/* Visual Guide */}
              <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-17 h-17 bg-blue-200 rounded-full mb-2 shadow-md p-2">
                    <img
                      src="/code.png"
                      alt="Developer Icon"
                      className="h-12 w-12 object-contain"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Look for this icon at the bottom right
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <Button
              onClick={() => setShowContactDeveloperDialog(false)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-2.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 shadow-md font-semibold"
            >
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
