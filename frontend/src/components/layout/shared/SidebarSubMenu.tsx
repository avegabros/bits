import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { CSSProperties, ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

interface SubMenuItem {
  href: string
  label: string
  icon: LucideIcon
  isActive: boolean
}

interface SidebarSubMenuProps {
  /** Main nav item */
  href: string
  label: string
  icon: LucideIcon
  /** Whether the parent group is active */
  isGroupActive: boolean
  /** Whether the submenu is expanded */
  isOpen: boolean
  /** Toggle submenu open/close */
  onToggle: () => void
  /** Whether sidebar is collapsed */
  collapsed: boolean
  /** Label style for collapse animation */
  labelStyle: CSSProperties
  /** Close the mobile sidebar */
  onClose?: () => void
  /** Sub-items to render */
  subItems: SubMenuItem[]
  /** Optional badge (e.g. pending count) */
  badge?: ReactNode
}

export function SidebarSubMenu({
  href, label, icon: Icon,
  isGroupActive, isOpen, onToggle,
  collapsed, labelStyle, onClose,
  subItems, badge,
}: SidebarSubMenuProps) {
  return (
    <li className="relative group" style={{ padding: '0 0 0 16px', overflow: 'visible' }}>
      <div className="flex items-center relative z-10">
        <Link
          href={href}
          onClick={onClose}
          className={`flex items-center gap-4 py-2.5 flex-1 cursor-pointer ${isGroupActive ? 'text-brand' : 'text-white/70 hover:text-white'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:bg-white/5 rounded-l-xl transition-colors duration-200`}
          style={{ paddingLeft: '12px' }}
        >
          <Icon size={22} className={`shrink-0 ${isGroupActive ? 'text-brand' : 'text-white/70'}`} />
          <span className="font-bold text-[15px] whitespace-nowrap motion-reduce:transition-none" style={labelStyle}>{label}</span>
          {badge}
        </Link>
        {!collapsed && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
            className={`p-2 mr-2 rounded-lg transition-colors shrink-0 ${isGroupActive ? 'text-brand' : 'text-white/70 hover:text-white'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:bg-white/10`}
            title="Toggle submenu"
            aria-expanded={isOpen}
            aria-label={`Toggle ${label} submenu`}
          >
            <ChevronDown
              size={16}
              className="motion-reduce:transition-none"
              style={{ transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        )}
      </div>
      {!collapsed && (
        <div
          style={{
            display: 'grid',
            gridTemplateRows: isOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            {subItems.map((sub) => {
              const SubIcon = sub.icon
              return (
                <div key={sub.href} className="pl-4 pr-3 pb-2 relative z-10">
                  <Link
                    href={sub.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[14px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:bg-white/5 ${
                      sub.isActive
                        ? isGroupActive ? 'bg-brand/10 text-brand' : 'bg-white/15 text-white'
                        : isGroupActive ? 'text-brand/70 hover:text-brand hover:bg-brand/5' : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <SubIcon size={15} className="shrink-0" />
                    {sub.label}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
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
