import { describe, expect, it } from 'vitest'
import { trackGains } from '../multitrack'

describe('volumen de cada pista', () => {
  const ids = ['bass', 'piano', 'vocals']
  it('respeta deslizadores y silencios', () => {
    expect(trackGains(ids, { piano: 0.5 }, { vocals: true }, null)).toEqual({ bass: 1, piano: 0.5, vocals: 0 })
  })
  it('el solo manda sobre los silencios y conserva su volumen', () => {
    expect(trackGains(ids, { vocals: 0.8 }, { vocals: true }, 'vocals')).toEqual({ bass: 0, piano: 0, vocals: 0.8 })
  })
})
