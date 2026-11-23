import { useEffect, useState } from 'react';
import { DeviceBreakpoint } from '../types/ide';

export function useViewport() {
  const [state, setState] = useState(() => {
    const width = window.innerWidth;
    const breakpoint: DeviceBreakpoint = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
    return {
      width,
      height: window.innerHeight,
      breakpoint,
      keyboardHeight: 0,
      isKeyboardOpen: false
    };
  });

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const layoutHeight = window.innerHeight;
      const vv = window.visualViewport;
      const visualHeight = vv ? vv.height : layoutHeight;
      const keyboardHeight = Math.max(0, Math.round(layoutHeight - visualHeight));
      const breakpoint: DeviceBreakpoint = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

      setState({
        width,
        height: visualHeight,
        breakpoint,
        keyboardHeight,
        isKeyboardOpen: keyboardHeight > 120
      });
    };

    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    update();

    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  return state;
}
