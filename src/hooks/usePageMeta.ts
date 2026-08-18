import { useEffect } from 'react'

/**
 * PER-ROUTE TITLE AND DESCRIPTION.
 *
 * A single-page app serves one `index.html` for every URL, so without this the
 * whole site shares one title and one description. Every page Google indexes
 * gets the same snippet, they compete with each other for the same queries, and
 * a link to /studio pasted anywhere previews as if it were the home page.
 *
 * Google executes JavaScript and will pick these up. Several crawlers that
 * matter — and most link-preview unfurlers — do not, which is why the
 * home-page defaults and the structured data live in the static HTML and this
 * only refines things from there. It improves search; it is not load-bearing
 * for a paste into Discord.
 *
 * The canonical link is updated too, because a SPA route that keeps the root
 * canonical tag is telling search engines every page IS the root — which is a
 * fast way to have five pages collapse into one result.
 */
export function usePageMeta({ title, description, path }: {
  title: string
  description: string
  /** Route path, e.g. '/studio'. Used for the canonical URL. */
  path?: string
}) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      const previous = el.getAttribute('content')
      el.setAttribute('content', value)
      return () => { if (previous !== null) el!.setAttribute('content', previous) }
    }

    const restores = [
      setMeta('meta[name="description"]', 'name', 'description', description),
      setMeta('meta[property="og:title"]', 'property', 'og:title', title),
      setMeta('meta[property="og:description"]', 'property', 'og:description', description),
      setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title),
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description),
    ]

    let restoreCanonical: (() => void) | undefined
    if (path) {
      const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (link) {
        const previous = link.href
        link.href = `https://csgn.fun${path}`
        restoreCanonical = () => { link.href = previous }
      }
    }

    return () => {
      document.title = previousTitle
      for (const restore of restores) restore()
      restoreCanonical?.()
    }
  }, [title, description, path])
}

export default usePageMeta
