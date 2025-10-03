/**
 * Pure waveform generation utilities
 * Creates sample data for visualization nodes
 */

/**
 * Generate sine wave samples
 * @param {number} numSamples - Number of samples to generate
 * @param {number} cycles - Number of complete cycles (default: 1)
 * @returns {number[]} Array of values between 0 and 1
 */
export function generateSine(numSamples, cycles = 1) {
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const phase = (i / (numSamples - 1)) * cycles * Math.PI * 2;
    const value = (Math.sin(phase) + 1) / 2;
    samples.push(value);
  }
  return samples;
}

/**
 * Generate sawtooth wave samples
 * @param {number} numSamples - Number of samples to generate
 * @param {number} cycles - Number of complete cycles (default: 1)
 * @returns {number[]} Array of values between 0 and 1
 */
export function generateSawtooth(numSamples, cycles = 1) {
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const phase = ((i / (numSamples - 1)) * cycles) % 1;
    samples.push(phase);
  }
  return samples;
}

/**
 * Generate triangle wave samples
 * @param {number} numSamples - Number of samples to generate
 * @param {number} cycles - Number of complete cycles (default: 1)
 * @returns {number[]} Array of values between 0 and 1
 */
export function generateTriangle(numSamples, cycles = 1) {
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const phase = ((i / (numSamples - 1)) * cycles) % 1;
    const value = phase < 0.5 ? phase * 2 : 2 - (phase * 2);
    samples.push(value);
  }
  return samples;
}

/**
 * Generate square wave samples
 * @param {number} numSamples - Number of samples to generate
 * @param {number} cycles - Number of complete cycles (default: 1)
 * @param {number} dutyCycle - Duty cycle (0-1, default: 0.5)
 * @returns {number[]} Array of values between 0 and 1
 */
export function generateSquare(numSamples, cycles = 1, dutyCycle = 0.5) {
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const phase = ((i / (numSamples - 1)) * cycles) % 1;
    const value = phase < dutyCycle ? 1 : 0;
    samples.push(value);
  }
  return samples;
}

/**
 * Generate smoothly random waveform
 * @param {number} numSamples - Number of samples to generate
 * @param {number} smoothPasses - Number of smoothing passes (default: 2)
 * @returns {number[]} Array of values between 0 and 1
 */
export function generateRandomSmooth(numSamples, smoothPasses = 2) {
  const samples = [];
  
  // Generate random starting values
  let value = Math.random();
  for (let i = 0; i < numSamples; i++) {
    value += Math.random() * 0.2 - 0.1; // Small random walk
    value = Math.max(0, Math.min(1, value)); // Clamp to [0,1]
    samples.push(value);
  }
  
  // Smooth the waveform
  for (let pass = 0; pass < smoothPasses; pass++) {
    for (let i = 1; i < numSamples - 1; i++) {
      samples[i] = (samples[i - 1] + samples[i] + samples[i + 1]) / 3;
    }
  }
  
  return samples;
}

/**
 * Generate noise waveform
 * @param {number} numSamples - Number of samples to generate
 * @returns {number[]} Array of random values between 0 and 1
 */
export function generateNoise(numSamples) {
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    samples.push(Math.random());
  }
  return samples;
}

/**
 * Apply envelope to existing samples
 * @param {number[]} samples - Input samples
 * @param {string} type - Envelope type: 'linear', 'exponential', 'adsr'
 * @param {object} params - Envelope parameters
 * @returns {number[]} Modified samples
 */
export function applyEnvelope(samples, type = 'linear', params = {}) {
  const result = [...samples];
  const length = result.length;
  
  switch (type) {
    case 'linear':
      // Linear fade in/out
      const fadeIn = Math.floor(length * (params.fadeIn || 0.1));
      const fadeOut = Math.floor(length * (params.fadeOut || 0.1));
      
      for (let i = 0; i < fadeIn; i++) {
        result[i] *= i / fadeIn;
      }
      for (let i = 0; i < fadeOut; i++) {
        const idx = length - 1 - i;
        result[idx] *= i / fadeOut;
      }
      break;
      
    case 'exponential':
      // Exponential envelope
      const attack = params.attack || 0.1;
      const decay = params.decay || 0.2;
      const sustain = params.sustain || 0.7;
      
      for (let i = 0; i < length; i++) {
        const t = i / (length - 1);
        let envelope = 1;
        
        if (t < attack) {
          envelope = Math.pow(t / attack, 2);
        } else if (t < attack + decay) {
          const decayT = (t - attack) / decay;
          envelope = 1 - (1 - sustain) * decayT;
        } else {
          envelope = sustain;
        }
        
        result[i] *= envelope;
      }
      break;
  }
  
  return result;
}

/**
 * Resample waveform to different length
 * @param {number[]} samples - Input samples
 * @param {number} newLength - Target length
 * @returns {number[]} Resampled array
 */
export function resample(samples, newLength) {
  if (samples.length === 0) return [];
  if (newLength === samples.length) return [...samples];
  
  const result = [];
  const ratio = (samples.length - 1) / (newLength - 1);
  
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const leftIndex = Math.floor(srcIndex);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const fraction = srcIndex - leftIndex;
    
    const leftValue = samples[leftIndex];
    const rightValue = samples[rightIndex];
    const interpolated = leftValue + (rightValue - leftValue) * fraction;
    
    result.push(interpolated);
  }
  
  return result;
}
