"use client"

import { useRef, useEffect } from 'react'

/**
 * Hook that converts vertical mouse wheel into horizontal scroll on a container.
 * - Scrolls the table horizontally first until it reaches the edge.
 * - After reaching the edge, waits briefly then allows vertical page scrolling.
 * - Prevents simultaneous horizontal + vertical scrolling.
 */
export function useHorizontalDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const isReady = useRef(false)
  const isDragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const scrollLeft = useRef(0)
  const atEdgeCount = useRef(0)
  const edgeThreshold = 5

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // ── Wheel Handler (Native deltaX support + deltaY fallback) ────────────
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      
      // If native horizontal scroll is happening (trackpad), don't interfere
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return

      const maxScrollLeft = el.scrollWidth - el.clientWidth
      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft >= maxScrollLeft - 1

      const scrollingRight = e.deltaY > 0
      const scrollingLeft = e.deltaY < 0
      const atEdge = (scrollingRight && atEnd) || (scrollingLeft && atStart)

      if (atEdge) {
        atEdgeCount.current++
        if (atEdgeCount.current >= edgeThreshold) return 
      } else {
        atEdgeCount.current = 0
      }

      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    // ── Pointer Handlers (Mouse Dragging) ──────────────────────────────────
    const onPointerDown = (e: PointerEvent) => {
      // Guard: Don't interfere with native touch scrolling
      if (e.pointerType === 'touch') return
      
      // Guard: Primary mouse button only
      if (e.button !== 0) return

      // Guard: Target Exclusion (Mandatory)
      if ((e.target as HTMLElement).closest('button, a, input, select, [role="button"]')) return

      isReady.current = true
      startPos.current = { x: e.pageX, y: e.pageY }
      scrollLeft.current = el.scrollLeft
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isReady.current) return

      const dx = e.pageX - startPos.current.x
      const dy = e.pageY - startPos.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Threshold: 5px to distinguish between click and drag
      if (!isDragging.current && distance > 5) {
        isDragging.current = true
        el.style.cursor = 'grabbing'
        el.style.userSelect = 'none'
      }

      if (isDragging.current) {
        e.preventDefault()
        el.scrollLeft = scrollLeft.current - dx
      }
    }

    const onPointerUp = () => {
      if (isDragging.current) {
        // Click Suppression: Prevent triggering buttons if we just finished a drag
        const preventClick = (event: MouseEvent) => {
          event.stopImmediatePropagation()
          el.removeEventListener('click', preventClick, true)
        }
        el.addEventListener('click', preventClick, true)
      }

      isReady.current = false
      isDragging.current = false
      el.style.cursor = ''
      el.style.userSelect = ''
    }

    const onPointerLeave = () => {
      if (isDragging.current) onPointerUp()
      isReady.current = false
      isDragging.current = false
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointerleave', onPointerLeave)

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  return ref
}
