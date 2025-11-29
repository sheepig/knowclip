# Subtitle Visibility Feature Implementation

## Overview
Added functionality to hide/show subtitle text tracks in the waveform area while maintaining the sentence segmentation and waveform chunk lengths.

## Features Implemented

### 1. Dropdown Control for Waveform Subtitle Visibility
- **Location**: Top-left of the waveform in `WaveformOperationsBar`
- **Options**:
  - Show All (default)
  - Hide Meaning
  - Hide Transcription
  - Hide Both

**Implementation**: The dropdown filters which subtitle tracks are displayed in the waveform chunks, but does not affect the underlying sentence segmentation or chunk dimensions.

### 2. Keyboard Shortcuts for Video Subtitle Tracks
- **Keys**: 1, 2, 3... (corresponding to subtitle track index)
- **Function**: Quickly toggle visibility of subtitle tracks in the video player
- **Behavior**: Press the number key to show/hide the corresponding subtitle track

**Implementation**: Event listener in Media component that:
- Listens for number keys (1-9)
- Ignores input when typing in text fields
- Toggles the track's `mode` between 'showing' and 'hidden'

### 3. Performance Considerations
- Used `useMemo` to calculate visible track count
- Filtered subtitle tracks only when visibility state changes
- No re-rendering of waveform when hiding/showing subtitles - only the text elements are conditionally rendered

## Files Modified

1. **src/types/WaveformSubtitleVisibility.ts** (NEW)
   - Type definition for visibility states

2. **src/components/Main.tsx**
   - Added subtitle visibility state management
   - Calculated visible track count for waveform height adjustment
   - Passed visibility state to child components

3. **src/components/WaveformOperationsBar.tsx**
   - Added Select dropdown for subtitle visibility control
   - Styled to match existing dark theme

4. **src/components/WaveformSubtitlesChunk.tsx**
   - Modified to filter visible subtitle tracks based on visibility state
   - Adjusted chunk height calculation dynamically
   - Maintained click/selection functionality regardless of visibility

5. **src/components/Media.tsx**
   - Added keyboard shortcut handler for toggling video subtitle tracks
   - Dispatches show/hide subtitle actions based on current track mode

## Technical Details

### Waveform Text Hiding
The waveform subtitle chunks now filter which tracks to display based on the visibility state:
```typescript
const visibleTrackIds = subsBases.linkedTrackIds.filter((id) => {
  if (visibility === 'SHOW_ALL') return true
  if (visibility === 'HIDE_BOTH') {
    if (id === transcriptionTrackId || id === meaningTrackId) return false
  }
  if (visibility === 'HIDE_TRANSCRIPTION' && id === transcriptionTrackId)
    return false
  if (visibility === 'HIDE_MEANING' && id === meaningTrackId) return false
  return true
})
```

### Keyboard Shortcuts
Number keys 1-9 toggle video subtitle tracks:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore when typing in input fields
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
    // Ignore when modifier keys are pressed
    if (e.metaKey || e.ctrlKey || e.altKey) return

    const num = parseInt(e.key)
    if (!isNaN(num) && num > 0 && num <= subtitles.all.length) {
      // Toggle the track visibility
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [subtitles.all, dispatch])
```

## User Experience

1. **Waveform Area**: Users can select from a dropdown which subtitle fields to hide in the waveform visualization
2. **Video Player**: Users can press number keys to quickly toggle individual subtitle tracks on/off
3. **Learning Mode**: Hiding subtitles allows users to test comprehension while still being able to click on waveform segments to create flashcards
4. **Performance**: The implementation is optimized - only text rendering changes, not the entire waveform structure
