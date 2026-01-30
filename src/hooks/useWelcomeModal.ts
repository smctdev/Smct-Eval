import { useState, useEffect } from 'react';

/**
 * Hook to manage welcome modal display logic
 * Shows modal every time user logs in (once per session)
 */
export function useWelcomeModal(userRole: string | null | undefined) {
  const [shouldShowModal, setShouldShowModal] = useState(false);

  useEffect(() => {
    if (!userRole) {
      setShouldShowModal(false);
      return;
    }

    // Create a unique key for each role
    const storageKey = `welcomeModal_${userRole}_shown`;
    
    // Check if modal has been shown in this session
    const hasBeenShown = sessionStorage.getItem(storageKey);

    console.log('[WelcomeModal] Checking modal display:', {
      userRole,
      storageKey,
      hasBeenShown,
      shouldShow: !hasBeenShown
    });

    // If not shown in this session, show modal
    if (!hasBeenShown) {
      setShouldShowModal(true);
    } else {
      setShouldShowModal(false);
    }
  }, [userRole]);

  /**
   * Mark the modal as shown for this session
   * Call this when user closes the modal
   */
  const markAsShown = () => {
    if (!userRole) return;
    
    const storageKey = `welcomeModal_${userRole}_shown`;
    sessionStorage.setItem(storageKey, 'true');
    setShouldShowModal(false);
  };

  /**
   * Force show the modal (for manual trigger)
   */
  const showModal = () => {
    setShouldShowModal(true);
  };

  /**
   * Force hide the modal without marking as shown
   */
  const hideModal = () => {
    setShouldShowModal(false);
  };

  return {
    shouldShowModal,
    markAsShown,
    showModal,
    hideModal,
  };
}

