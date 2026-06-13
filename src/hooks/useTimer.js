import { useState, useEffect, useRef } from 'react';
import { FocusTimer, getLogicalDateStr } from '../logic/Timer';

export function useTimer() {
    const getInitialState = () => {
        const defaultState = {
            mode: 'stopwatch',
            isRunning: false,
            timeRemaining: 25 * 60 * 1000,
            timeElapsed: 0,
            dailyTotal: 0,
            laps: []
        };
        const saved = localStorage.getItem('focusTimerState');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Check if the saved state is from today (logical date based on 4AM IST)
                if (parsed.currentDate === getLogicalDateStr()) {
                    return { ...defaultState, ...parsed, isRunning: false };
                }
                // If it's a new day, return default state but maybe keep the mode
                return { ...defaultState, mode: parsed.mode || 'stopwatch' };
            } catch(e) {}
        }
        return defaultState;
    };

    const [timerState, setTimerState] = useState(getInitialState);

    const timerRef = useRef(null);

    useEffect(() => {
        timerRef.current = new FocusTimer(
            (newState) => {
                setTimerState(prevState => ({ ...prevState, ...newState }));
            },
            () => {
                console.log("Timer completed!");
            }
        );

        return () => {
            if (timerRef.current) {
                timerRef.current.pause();
            }
        };
    }, []);

    const start = () => timerRef.current?.start();
    const pause = () => timerRef.current?.pause();
    const reset = () => timerRef.current?.reset();
    const lap = () => timerRef.current?.lap();
    const setMode = (mode) => timerRef.current?.setMode(mode);
    const setDuration = (seconds) => timerRef.current?.setDuration(seconds);

    // Format MS into MM:SS.d (tenths) or H:MM:SS.d
    const formatTime = (totalMs) => {
        const totalSeconds = Math.floor(totalMs / 1000);
        const tenths = Math.floor((totalMs % 1000) / 100);
        
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        
        const pad = (num) => num.toString().padStart(2, '0');

        if (h > 0) {
            return `${h}:${pad(m)}:${pad(s)}.${tenths}`;
        }
        return `${pad(m)}:${pad(s)}.${tenths}`;
    };

    const syncFromDb = (dbDailyTotal, dbLaps) => timerRef.current?.syncFromDb(dbDailyTotal, dbLaps);

    return {
        ...timerState,
        start,
        pause,
        reset,
        lap,
        setMode,
        setDuration,
        formatTime,
        syncFromDb
    };
}
