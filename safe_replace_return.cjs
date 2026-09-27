const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const originalReturn = `  return (
    <>
      <BackgroundLayer backgroundType={backgroundType} />`;

const replacementReturn = `  return (
    <>
      <SpotifyWidget ref={spotifyRef} isOpen={activeWidget === 'music' && !vinylTheme} onClose={() => setActiveWidget(null)} onPlaybackChange={setSpotifyPlayback} />
      {vinylTheme ? (
        <ImmersiveVinylTheme 
          timerState={{ mode, isRunning, timeRemaining, timeElapsed, start, pause, reset, lap, laps, formatTime, setDuration, dailyTotal }}
          spotifyState={spotifyPlayback}
          spotifyControls={spotifyRef.current}
          onExit={() => setVinylTheme(false)}
        />
      ) : (
        <>
          <BackgroundLayer backgroundType={backgroundType} />`;

if (code.includes(originalReturn)) {
  code = code.replace(originalReturn, replacementReturn);
  
  // Also we need to remove the old <SpotifyWidget ... /> from inside the left panel
  code = code.replace(/<SpotifyWidget isOpen=\{activeWidget === 'music'\}.*?\/>/g, "");
  
  // And fix the ending braces
  let lastIdx = code.lastIndexOf("</>");
  if (lastIdx !== -1) {
    code = code.substring(0, lastIdx) + "</>\\n      )}\n    </>";
  }
  
  fs.writeFileSync('src/App.jsx', code);
  console.log("Successfully replaced the return block.");
} else {
  console.log("Could not find the original return block exact string.");
}
