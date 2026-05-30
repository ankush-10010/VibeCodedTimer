export function getLogicalDateStr() {
    const now = new Date();
    // Shift back by 4 hours
    const shifted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    // Convert to IST string (Asia/Kolkata is UTC+5:30)
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(shifted);
    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;
    return `${year}-${month}-${day}`;
}

export class FocusTimer {
    constructor(onTickCallback, onCompleteCallback) {
        this.mode = 'stopwatch'; // 'pomodoro' | 'stopwatch' | 'break'
        this.timeRemaining = 25 * 60 * 1000; // in ms
        this.timeElapsed = 0; // in ms
        this.dailyTotal = 0; // in ms (Focus + Stopwatch)
        this.laps = []; // Array to store lap times
        this.isRunning = false;

        this.currentDate = getLogicalDateStr();

        const savedState = localStorage.getItem('focusTimerState');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                this.mode = parsed.mode || this.mode;
                this.timeRemaining = parsed.timeRemaining !== undefined ? parsed.timeRemaining : this.timeRemaining;
                this.timeElapsed = parsed.timeElapsed || 0;
                
                // Only load dailyTotal and laps if the date matches today
                if (parsed.currentDate === this.currentDate) {
                    this.dailyTotal = parsed.dailyTotal || 0;
                    this.laps = parsed.laps || [];
                }
                
                // If it was running when closed, catch up
                if (parsed.isRunning && parsed.lastTickTime) {
                    const now = Date.now();
                    const delta = now - parsed.lastTickTime;
                    
                    if (this.mode === 'stopwatch') {
                        this.timeElapsed += delta;
                        this.dailyTotal += delta;
                    } else if (this.mode === 'pomodoro' || this.mode === 'break') {
                        this.timeRemaining -= delta;
                        if (this.mode === 'pomodoro') this.dailyTotal += delta;
                        if (this.timeRemaining <= 0) {
                            this.timeRemaining = 0;
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to parse timer state", e);
            }
        }
        
        this.interval = null;
        this.lastTickTime = null;
        this.lastSavedTime = 0;

        this.onTick = onTickCallback || (() => {});
        this.onComplete = onCompleteCallback || (() => {});
        
        if (this.timeRemaining <= 0 && this.mode !== 'stopwatch') {
            setTimeout(() => this.onComplete(), 0);
        }
    }

    checkDate() {
        const today = getLogicalDateStr();
        if (this.currentDate !== today) {
            this.dailyTotal = 0;
            this.laps = [];
            this.currentDate = today;
            this.saveState();
            this.onTick(this.getState());
        }
    }

    saveState() {
        localStorage.setItem('focusTimerState', JSON.stringify({
            mode: this.mode,
            timeRemaining: this.timeRemaining,
            timeElapsed: this.timeElapsed,
            dailyTotal: this.dailyTotal,
            laps: this.laps,
            isRunning: this.isRunning,
            currentDate: this.currentDate,
            lastTickTime: this.lastTickTime || Date.now()
        }));
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTickTime = Date.now();
        this.saveState();
        
        this.interval = setInterval(() => {
            this.checkDate(); // Ensure stats reset if midnight passes while running

            const now = Date.now();
            const delta = now - this.lastTickTime;
            this.lastTickTime = now;

            if (this.mode === 'stopwatch') {
                this.timeElapsed += delta;
                this.dailyTotal += delta;
                this.onTick(this.getState());
            } else if (this.mode === 'pomodoro') {
                if (this.timeRemaining > 0) {
                    this.timeRemaining -= delta;
                    this.dailyTotal += delta; // Pomodoro counts as focus time
                    if (this.timeRemaining <= 0) {
                        this.timeRemaining = 0;
                        this.pause();
                        this.onComplete();
                    }
                    this.onTick(this.getState());
                }
            } else if (this.mode === 'break') {
                if (this.timeRemaining > 0) {
                    this.timeRemaining -= delta;
                    if (this.timeRemaining <= 0) {
                        this.timeRemaining = 0;
                        this.pause();
                        this.onComplete();
                    }
                    // Break mode does NOT add to dailyTotal
                    this.onTick(this.getState());
                }
            }
            
            if (now - this.lastSavedTime > 1000) {
                this.saveState();
                this.lastSavedTime = now;
            }
        }, 30); // roughly 30 FPS for smooth centiseconds
    }

    pause() {
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.saveState();
        this.onTick(this.getState());
    }

    lap() {
        if (this.mode === 'stopwatch') {
            this.laps.push(this.timeElapsed);
            this.timeElapsed = 0; // Resets session, total keeps going
            this.saveState();
            this.onTick(this.getState());
        }
    }

    reset() {
        this.pause();
        if (this.mode === 'pomodoro') {
            this.timeRemaining = 25 * 60 * 1000; 
        } else if (this.mode === 'break') {
            this.timeRemaining = 10 * 60 * 1000; 
        } else if (this.mode === 'stopwatch') {
            this.timeElapsed = 0;
            this.laps = [];
        }
        this.saveState();
        this.onTick(this.getState());
    }

    setMode(newMode) {
        this.pause();
        this.mode = newMode;
        if (this.mode === 'pomodoro') {
            this.timeRemaining = 25 * 60 * 1000;
        } else if (this.mode === 'break') {
            this.timeRemaining = 10 * 60 * 1000;
        }
        this.saveState();
        this.onTick(this.getState());
    }

    setDuration(seconds) {
        this.pause();
        this.timeRemaining = seconds * 1000;
        this.saveState();
        this.onTick(this.getState());
    }

    getState() {
        return {
            mode: this.mode,
            isRunning: this.isRunning,
            timeRemaining: this.timeRemaining,
            timeElapsed: this.timeElapsed,
            dailyTotal: this.dailyTotal,
            laps: this.laps
        };
    }
}
