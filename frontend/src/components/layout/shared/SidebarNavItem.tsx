import Link from 'next/link'
import { LucideIcon } from 'lucide-react'
import { CSSProperties, ReactNode } from 'react'

interface SidebarNavItemProps {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
  collapsed: boolean
  labelStyle: CSSProperties
  onClick?: () => void
  /** Optional: right-side badge or extra content */
  badge?: ReactNode
}

export function SidebarNavItem({
  href, label, icon: Icon, active, collapsed, labelStyle, onClick, badge,
}: SidebarNavItemProps) {
  return (
    <li className="relative group" style={{ padding: '0 0 0 16px', overflow: 'visible' }}>
      <Link
        href={href}
        onClick={onClick}
        className={`flex items-center gap-4 py-2.5 relative z-10 cursor-pointer ${active ? 'text-brand' : 'text-white/70 hover:text-white'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:bg-white/5 rounded-l-xl transition-colors duration-200`}
        style={{ paddingLeft: '12px', paddingRight: collapsed ? '12px' : '24px' }}
      >
        <Icon size={22} className={`shrink-0 ${active ? 'text-brand' : 'text-white/70'}`} />
        <span className="font-bold text-[15px] whitespace-nowrap motion-reduce:transition-none" style={labelStyle}>{label}</span>
        {badge}
      </Link>
      {collapsed && (
        <span
          role="tooltip"
          className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-lg z-50 top-1/2 -translate-y-1/2"
        >
          {label}
        </span>
      )}
    </li>
  )
}
