import { useState, useCallback, useRef } from 'react';

export interface ZoomState {
  left: string | number;
  right: string | number;
  refLeft: string;
  refRight: string;
  isZoomed: boolean;
}

const INITIAL: ZoomState = {
  left: 'dataMin',
  right: 'dataMax',
  refLeft: '',
  refRight: '',
  isZoomed: false,
};

/**
 * Manages drag-to-zoom state for recharts.
 *
 * Usage:
 *   const zoom = useChartZoom();
 *   <LineChart onMouseDown={zoom.onMouseDown} onMouseMove={zoom.onMouseMove} onMouseUp={zoom.onMouseUp}>
 *     <XAxis domain={[zoom.state.left, zoom.state.right]} ... />
 *     {zoom.state.refLeft && zoom.state.refRight && (
 *       <ReferenceArea x1={zoom.state.refLeft} x2={zoom.state.refRight} strokeOpacity={0.3} />
 *     )}
 *   </LineChart>
 */
export function useChartZoom() {
  const [state, setState] = useState<ZoomState>(INITIAL);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: { activeLabel?: string | number } | null) => {
    if (!e?.activeLabel) return;
    dragging.current = true;
    setState(prev => ({ ...prev, refLeft: String(e.activeLabel), refRight: '' }));
  }, []);

  const onMouseMove = useCallback((e: { activeLabel?: string | number } | null) => {
    if (!dragging.current || !e?.activeLabel) return;
    setState(prev => ({ ...prev, refRight: String(e.activeLabel) }));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    setState(prev => {
      const { refLeft, refRight } = prev;
      if (!refLeft || !refRight || refLeft === refRight) {
        return { ...prev, refLeft: '', refRight: '' };
      }
      const l = Number(refLeft);
      const r = Number(refRight);
      return {
        left: Math.min(l, r),
        right: Math.max(l, r),
        refLeft: '',
        refRight: '',
        isZoomed: true,
      };
    });
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, onMouseDown, onMouseMove, onMouseUp, reset };
}
