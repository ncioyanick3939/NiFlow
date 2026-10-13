/** Links zu Datenschutzerklärung und Nutzungsbedingungen (statische Seiten im Ordner public/). */
export default function LegalLinks({ className = '' }: { className?: string }) {
  const link = 'underline underline-offset-2 hover:text-ink'
  return (
    <p className={`text-xs text-muted ${className}`}>
      <a href="./datenschutz.html" target="_blank" rel="noopener" className={link}>
        Datenschutz
      </a>
      <span aria-hidden="true"> · </span>
      <a href="./nutzungsbedingungen.html" target="_blank" rel="noopener" className={link}>
        Nutzungsbedingungen
      </a>
    </p>
  )
}
