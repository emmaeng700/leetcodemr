'use client'
import PatternReviewContent from './PatternReviewContent'

// Standalone route: wrap in the full-height container the hub would otherwise provide.
export default function PatternReviewPage() {
  return (
    <div className="h-[calc(100dvh-56px)]">
      <PatternReviewContent />
    </div>
  )
}
