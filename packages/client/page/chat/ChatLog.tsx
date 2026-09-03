import { Box, CircularProgress, Container, IconButton, Typography } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import React, { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { useScrollEffect } from '../../hook/useScrollEffect.js';
import ChatLogRow, { ChatLogRowProps } from './ChatLogRow.jsx';
import { GlassCircularProgress, ScrollGlow } from '../../layout/component/index.js';
import { DisplayTurn, TempChatTurn } from '@rita-berenice/shared/domain';
import { ChatGenerationStage } from '@rita-berenice/shared/api';
import type { ChatDisplayMode } from './chatDisplayMode.js';
import { CHAT_FONT_WEIGHT_VALUES, type ChatFontSize, type ChatFontWeight } from './chatFontSize.js';
import type { PortraitUrlMap } from '@rita-berenice/shared/config';

// Rough average height of one rendered turn, per display mode. Only an initial estimate for rows
// Virtuoso has not measured yet, so it does not need to be exact - it only needs to be closer to
// the truth than "however tall the newest turn happens to be". Conversation mode is taller because
// each turn draws two avatar bubbles.
const DEFAULT_TURN_HEIGHT: Record<ChatDisplayMode, number> = { conversation: 280, book: 200 };

const streamStatusText: Record<ChatGenerationStage, string> = {
  preparing: 'Preparing response...',
  retrieving: 'Recalling memories...',
  generating: 'Writing...',
  saving: 'Saving response...',
};

interface ChatLogProps {
  allTurns: (DisplayTurn | TempChatTurn)[];
  currentTempSetNo: number;
  changeTempSetNo: (index: number) => void;
  isLoadingChat: boolean;
  isProcessing: boolean;
  clientError?: string;
  userEditInput: string;
  botEditInput: string;
  onEditTempTurnText: (value: string, req: boolean) => void;
  onSaveTempTurnText: () => void;
  onRegenerateResponse: () => void;
  onContinueResponse: () => void;
  onDeleteTempTurn: () => Promise<void>;
  onUpdateFixedTurn: (sequence: number, userText: string, botText: string) => Promise<void>;
  onDeleteTurnsFromSequence: (sequence: number) => Promise<void>;
  shouldUseMobileLayout: boolean;
  streamingText: string;
  streamingStage?: ChatGenerationStage;
  // The focused index deliberately does NOT live here. It changes on every scroll tick, and
  // anything passed in here reaches every row, which would re-render and re-measure the whole
  // list while the user is scrolling. ChatPage owns that state; the log only reports focus.
  onFocusTurn: (index: number) => void; // Receive the handler
  displayMode: ChatDisplayMode;
  chatFontSize: ChatFontSize;
  chatFontWeight: ChatFontWeight;
  characterPortraitUrls?: PortraitUrlMap;
  characterAvatarUrls?: PortraitUrlMap;
  profileAvatarUrl?: string;
  localizeDirections?: boolean;
}

export const ChatLog: FC<ChatLogProps> = memo(
  ({
    allTurns,
    isLoadingChat,
    isProcessing,
    clientError,
    streamingText,
    streamingStage,
    shouldUseMobileLayout,
    onFocusTurn,
    displayMode,
    chatFontSize,
    chatFontWeight,
    currentTempSetNo,
    changeTempSetNo,
    userEditInput,
    botEditInput,
    onEditTempTurnText,
    onSaveTempTurnText,
    onRegenerateResponse,
    onContinueResponse,
    onDeleteTempTurn,
    onUpdateFixedTurn,
    onDeleteTurnsFromSequence,
    characterPortraitUrls,
    characterAvatarUrls,
    profileAvatarUrl,
    localizeDirections,
  }) => {
    // --- HOOKS ---
    const { isScrolling, showTopGlow, showBottomGlow, scrollerRef, isScrollingChange } = useScrollEffect();

    // --- REFS ---
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const rangeTimeoutRef = useRef<NodeJS.Timeout | null>(null); // ✅ This is what you need

    // --- Jump-to-bottom button state ---
    const [isAtBottom, setIsAtBottom] = useState(true);
    const handleJumpToBottom = useCallback(() => {
      const lastIndex = allTurns.length - 1;
      if (lastIndex < 0) return;
      const reducedMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      virtuosoRef.current?.scrollToIndex({
        index: lastIndex,
        align: 'end',
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    }, [allTurns.length]);

    // --- Handle viewport range changes with debouncing ---
    const handleRangeChanged = useCallback(
      (range: { startIndex: number; endIndex: number }) => {
        if (rangeTimeoutRef.current) clearTimeout(rangeTimeoutRef.current);

        rangeTimeoutRef.current = setTimeout(() => {
          const lastTurnIndex = allTurns.length - 1;
          if (lastTurnIndex < 0) return;

          let newFocusIndex = -1;
          if (range.startIndex >= lastTurnIndex - 1) {
            newFocusIndex = lastTurnIndex;
          } else {
            const actualEndIndex = Math.min(range.endIndex - 1, lastTurnIndex);
            const actualStartIndex = Math.max(range.startIndex, 0);
            newFocusIndex = Math.floor((actualStartIndex + actualEndIndex) / 2);
          }

          if (newFocusIndex !== -1) {
            onFocusTurn(newFocusIndex); // Call the parent's handler
          }
        }, 100);
      },
      [allTurns.length, onFocusTurn],
    );

    // --- Cleanup timeout on unmount ---
    useEffect(() => {
      return () => {
        if (rangeTimeoutRef.current) {
          clearTimeout(rangeTimeoutRef.current);
        }
      };
    }, []);

    // Virtuoso re-renders every mounted item whenever `itemContent` changes identity, so an
    // inline arrow here means a full re-render (and re-measure) on every parent render.
    const renderItemContent = useCallback(
      (_index: number, turn: DisplayTurn | TempChatTurn) => {
        const isTemp = 'setCount' in turn;
        const rowProps: ChatLogRowProps = {
          turn,
          isTemp,
          isProcessing: isTemp && isProcessing,
          displayMode,
          currentTempSetNo,
          changeTempSetNo,
          userEditInput,
          botEditInput,
          onEditTempTurnText,
          onSaveTempTurnText,
          onRegenerateResponse,
          onContinueResponse,
          onDeleteTempTurn,
          onUpdateFixedTurn,
          onDeleteTurnsFromSequence,
          characterPortraitUrls,
          characterAvatarUrls,
          profileAvatarUrl,
          localizeDirections,
        };
        return displayMode === 'conversation' ? (
          <Container maxWidth="md" sx={{ py: 1 }}>
            <ChatLogRow {...rowProps} />
          </Container>
        ) : (
          <Box sx={{ py: 1, px: 1 }}>
            <ChatLogRow {...rowProps} />
          </Box>
        );
      },
      [
        isProcessing,
        displayMode,
        currentTempSetNo,
        changeTempSetNo,
        userEditInput,
        botEditInput,
        onEditTempTurnText,
        onSaveTempTurnText,
        onRegenerateResponse,
        onContinueResponse,
        onUpdateFixedTurn,
        onDeleteTurnsFromSequence,
        characterPortraitUrls,
        characterAvatarUrls,
        profileAvatarUrl,
        localizeDirections,
      ],
    );

    // Keying by sequence instead of the default index keeps a turn's DOM (and its measured
    // height) attached to the same turn when the list shifts - notably when the temp turn at
    // the tail finalizes and a new temp turn takes its place.
    const computeItemKey = useCallback(
      (_index: number, turn: DisplayTurn | TempChatTurn) =>
        'setCount' in turn ? `temp-${turn.sequence}` : `fixed-${turn.sequence}`,
      [],
    );

    const StreamFooter = useCallback(
      () => (
        <>
          {isProcessing && (streamingText || streamingStage) ? (
            <Box role="status" aria-live="polite" aria-busy sx={{ px: 2, py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <CircularProgress size={14} color="inherit" />
                <Typography variant="caption" color="text.secondary">
                  {streamingStage ? streamStatusText[streamingStage] : 'Writing...'}
                </Typography>
              </Box>
              {streamingText ? (
                <Typography
                  sx={{
                    fontSize: 'var(--chat-font-size)',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {streamingText}
                </Typography>
              ) : null}
            </Box>
          ) : null}
          {clientError ? (
            <Typography role="alert" aria-live="assertive" color="error" sx={{ p: 1, textAlign: 'center' }}>
              {clientError}
            </Typography>
          ) : null}
        </>
      ),
      [isProcessing, streamingText, streamingStage, clientError],
    );

    // A fresh `components` object remounts the footer on every render, which the streaming
    // text would otherwise trigger on every delta.
    const virtuosoComponents = useMemo(() => ({ Footer: StreamFooter }), [StreamFooter]);

    if (isLoadingChat && allTurns.length === 0) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" height="100%">
          <GlassCircularProgress colorVariant="silver" />
        </Box>
      );
    }

    return (
      <Box
        sx={{
          '--chat-font-size': `${chatFontSize}px`,
          '--chat-font-weight': CHAT_FONT_WEIGHT_VALUES[chatFontWeight],
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          py: 1,
        }}
      >
        <ScrollGlow
          showTop={showTopGlow}
          showBottom={showBottomGlow}
          isScrolling={isScrolling}
          shouldUseMobileLayout={shouldUseMobileLayout}
        />
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%', width: '100%' }}
          data={allTurns}
          initialTopMostItemIndex={{ index: 'LAST', align: 'end' }}
          followOutput="auto"
          className="hide-scrollbar"
          // Without this, Virtuoso estimates every unmeasured row from a single "probe"
          // row - and since the log opens at the bottom, the probe is whatever the last
          // turn happens to be. Scrolling up then renders a batch at that wrong estimate,
          // measures the real heights, corrects the scroll, and repeats: the visible
          // rows drift up and back down. A fixed estimate keeps each correction small.
          defaultItemHeight={DEFAULT_TURN_HEIGHT[displayMode]}
          // Mount rows well above and below the viewport so their real heights are
          // measured while they are still off-screen. The correction then happens to
          // content the user cannot see, instead of under their eyes. The top side is
          // larger because scrolling back through history is the painful direction.
          increaseViewportBy={{ top: 1600, bottom: 800 }}
          computeItemKey={computeItemKey}
          // Direct DOM access with correct callback type
          scrollerRef={scrollerRef}
          isScrolling={isScrollingChange} // Fallback only
          rangeChanged={handleRangeChanged}
          atBottomStateChange={setIsAtBottom}
          itemContent={renderItemContent}
          components={virtuosoComponents}
        />
        {!isAtBottom && (
          <IconButton
            onClick={handleJumpToBottom}
            aria-label="Jump to latest message"
            size="small"
            sx={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              color: 'white',
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' },
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              zIndex: 5,
            }}
          >
            <KeyboardArrowDownIcon />
          </IconButton>
        )}
      </Box>
    );
  },
);
