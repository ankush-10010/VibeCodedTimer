export class FocusTimer {
    constructor(onTickCallback, onCompleteCallback) {
        this.mode = 'stopwatch'; // 'pomodoro' | 'stopwatch' | 'break'
        this.timeRemaining = 25 * 60 * 1000; // in ms
        this.timeElapsed = 0; // in ms
        this.dailyTotal = 0; // in ms (Focus + Stopwatch)
        this.laps = []; // Array to store lap times
        
        this.isRunning = false;
        this.interval = null;
        this.lastTickTime = null;

        this.onTick = onTickCallback || (() => {});
        this.onComplete = onCompleteCallback || (() => {});
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTickTime = Date.now();
        
        this.interval = setInterval(() => {
            const now = Date.now();
            const delta = now - this.lastTickTime;
            this.lastTickTime = now;

            if (this.mode === 'stopwatch') {
                this.timeElapsed += delta;
                this.dailyTotal += delta; // Stopwatch counts as focus time
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
        }, 30); // roughly 30 FPS for smooth centiseconds
    }

    pause() {
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.onTick(this.getState());
    }

    lap() {
        if (this.mode === 'stopwatch') {
            this.laps.push(this.timeElapsed);
            this.timeElapsed = 0; // Resets session, total keeps going
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
        this.onTick(this.getState());
    }

    setDuration(seconds) {
        this.pause();
        this.timeRemaining = seconds * 1000;
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
