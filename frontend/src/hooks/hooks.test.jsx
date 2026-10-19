// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSustained } from './useSustained.js';
import { useBackgroundNotice } from './useBackgroundNotice.js';
import { useRoute } from './usePreferences.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('useSustained', () => {
    it('only turns true after the condition held for the whole delay', () => {
        const { result } = renderHook(({ on }) => useSustained(on, 3000), { initialProps: { on: true } });
        expect(result.current).toBe(false);
        act(() => vi.advanceTimersByTime(2999));
        expect(result.current).toBe(false);
        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toBe(true);
    });

    it('resets as soon as the condition clears', () => {
        const { result, rerender } = renderHook(({ on }) => useSustained(on, 1000), { initialProps: { on: true } });
        act(() => vi.advanceTimersByTime(1000));
        expect(result.current).toBe(true);
        rerender({ on: false });
        expect(result.current).toBe(false);
    });

    it('ignores a blip shorter than the delay', () => {
        const { result, rerender } = renderHook(({ on }) => useSustained(on, 1000), { initialProps: { on: true } });
        act(() => vi.advanceTimersByTime(500));
        rerender({ on: false });
        act(() => vi.advanceTimersByTime(2000));
        expect(result.current).toBe(false);
    });
});

describe('useBackgroundNotice', () => {
    const setVisibility = (state) => {
        Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    };

    it('shows the notice when the tab returns after a long absence while mining', () => {
        const { result } = renderHook(() => useBackgroundNotice(true));
        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(5000));
        act(() => setVisibility('visible'));
        expect(result.current.visible).toBe(true);
    });

    it('stays quiet for a brief tab switch', () => {
        const { result } = renderHook(() => useBackgroundNotice(true));
        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(1000));
        act(() => setVisibility('visible'));
        expect(result.current.visible).toBe(false);
    });

    it('stays quiet when nothing is mining', () => {
        const { result } = renderHook(() => useBackgroundNotice(false));
        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(10000));
        act(() => setVisibility('visible'));
        expect(result.current.visible).toBe(false);
    });

    it('dismisses itself after a while', () => {
        const { result } = renderHook(() => useBackgroundNotice(true));
        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(5000));
        act(() => setVisibility('visible'));
        expect(result.current.visible).toBe(true);
        act(() => vi.advanceTimersByTime(12000));
        expect(result.current.visible).toBe(false);

        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(5000));
        act(() => setVisibility('visible'));
        expect(result.current.visible).toBe(true);
    });
});

describe('useRoute', () => {
    beforeEach(() => {
        window.location.hash = '';
        window.scrollTo = vi.fn();
    });

    it('starts from the current hash and follows navigation', () => {
        window.location.hash = '#/history';
        const { result } = renderHook(() => useRoute());
        expect(result.current[0]).toBe('history');

        act(() => {
            result.current[1]('config');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        expect(result.current[0]).toBe('config');
        expect(window.location.hash).toBe('#/config');
    });

    it('scrolls back to the top when the screen changes', () => {
        const { result } = renderHook(() => useRoute());
        window.scrollTo.mockClear();
        act(() => {
            result.current[1]('help');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    });
});
