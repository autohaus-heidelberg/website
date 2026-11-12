import { describe, it, expect, vi, afterEach } from 'vitest'
import { initPhotoReveal } from '../utils/photoReveal'

describe('initPhotoReveal', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does nothing without IntersectionObserver or on devices with hover', () => {
    expect(initPhotoReveal()).toBe(false)

    vi.stubGlobal('IntersectionObserver', class { observe() {} })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(initPhotoReveal()).toBe(false)
  })

  it('reveals photos in the middle of the screen on touch devices', () => {
    let callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void = () => {}
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: typeof callback) { callback = cb }
      observe() {}
    })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    document.body.innerHTML = '<div class="fz-photo"></div>'

    expect(initPhotoReveal()).toBe(true)
    const photo = document.querySelector('.fz-photo')!
    callback([{ target: photo, isIntersecting: true }])
    expect(photo.classList.contains('is-revealed')).toBe(true)
    callback([{ target: photo, isIntersecting: false }])
    expect(photo.classList.contains('is-revealed')).toBe(false)
  })
})
