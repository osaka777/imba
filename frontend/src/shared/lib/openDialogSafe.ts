import { useCallback, useRef } from "react";

/** Opens a Radix dialog on the next frame — avoids iOS Safari closing it from the same tap. */
export const scheduleDialogOpen = (setOpen: (open: boolean) => void) => {
  requestAnimationFrame(() => setOpen(true));
};

export const useDialogOutsideGuard = () => {
  const guardRef = useRef(false);

  const armGuard = useCallback(() => {
    guardRef.current = true;
    window.setTimeout(() => {
      guardRef.current = false;
    }, 400);
  }, []);

  const blockIfArmed = useCallback((event: Event) => {
    if (guardRef.current) {
      event.preventDefault();
    }
  }, []);

  return { armGuard, blockIfArmed };
};
