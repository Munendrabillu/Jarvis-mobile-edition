
 // ===== 3. TOOLS (THE HANDS) — 5 WORKING TOOLS =====
async function handleTools(text) {
  const t = text.toLowerCase().trim();

  // ===== 1. TIME =====
  if (
    /\btime\b/.test(t) ||
    t.includes('టైమ్') ||
    t.includes('సమయం')
  ) {
    return 'The time is ' +
      new Date().toLocaleTimeString() +
      ', Boss.';
  }

  // ===== 2. WEATHER =====
  if (
    t.includes('weather') ||
    t.includes('వాతావరణం')
  ) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('Geolocation is not supported, Boss.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (p) => {
          try {
            const r = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&current_weather=true`
            );

            if (!r.ok) throw new Error('Weather API error');

            const d = await r.json();

            resolve(
              `It is ${d.current_weather.temperature} degrees Celsius now, Boss.`
            );
          } catch (e) {
            resolve('Weather service error, Boss.');
          }
        },
        () => resolve('I need location permission for weather, Boss.')
      );
    });
  }

  // ===== 3. TIMER =====
  const m = t.match(
    /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i
  );

  if (
    (t.includes('timer') || t.includes('టైమర్')) &&
    m
  ) {
    const amount = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();

    let factor = 1000;

    if (/^(minutes?|mins?)$/.test(unit)) {
      factor = 60000;
    } else if (/^(hours?|hrs?)$/.test(unit)) {
      factor = 3600000;
    }

    const duration = amount * factor;

    setTimeout(() => {
      if (typeof speak === 'function') {
        speak(`Boss, ${amount} ${unit} timer finished.`);
      } else {
        alert(`Timer finished: ${amount} ${unit}`);
      }
    }, duration);

    return `Timer set for ${amount} ${unit}, Boss.`;
  }

  // ===== 4. TRANSLATE =====
  if (
    t.includes('translate') ||
    t.includes('అనువదించు')
  ) {
    const q = text
      .replace(/^translate(?:\s+this)?\s*/i, '')
      .replace(/^అనువదించు\s*/i, '')
      .trim() || 'hello';

    try {
      const r = await fetch(
        'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(q) +
        '&langpair=en|te'
      );

      if (!r.ok) throw new Error('Translation API error');

      const d = await r.json();

      return 'In Telugu: ' +
        d.responseData.translatedText;
    } catch (e) {
      return 'Translate error, Boss.';
    }
  }

  // ===== 5. YOUTUBE PLAY =====
  if (
    t.includes('play ') ||
    t.includes('youtube')
  ) {
    const q = text
      .replace(/play\s*/i, '')
      .replace(/youtube\s*/i, '')
      .trim();

    if (q) {
      window.open(
        'https://www.youtube.com/results?search_query=' +
        encodeURIComponent(q),
        '_blank'
      );

      return 'Searching YouTube for ' + q + ', Boss.';
    }
  }

  // ===== NO TOOL MATCH =====
  return null;
}
