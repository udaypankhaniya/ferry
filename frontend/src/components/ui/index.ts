// Ferry primitive kit — token-driven, VS Code aesthetic.
// Batch A (hand-built, cva + cn, zero extra deps). Overlays (Dialog, Menu,
// Tooltip, Popover via Radix), Tabs, and Toast land in Batch B.
export { Button, buttonVariants, type ButtonProps } from './Button'
export { IconButton, iconButtonVariants, type IconButtonProps } from './IconButton'
export { Input, type InputProps } from './Input'
export { Select, type SelectProps } from './Select'
export { Checkbox, type CheckboxProps } from './Checkbox'
export { FormField, type FormFieldProps } from './FormField'
export { Badge, badgeVariants, type BadgeProps } from './Badge'
export { TrustBadge, providerTrust, type TrustKind } from './TrustBadge'
export { Spinner } from './Spinner'
export { Progress } from './Progress'
export { Skeleton } from './Skeleton'
export { EmptyState } from './EmptyState'

// Batch B — overlays (Radix-backed) + tabs + toast
export { Tooltip, TooltipProvider } from './Tooltip'
export { Dialog, DialogTrigger, DialogClose, DialogContent } from './Dialog'
export { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from './Menu'
export {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
} from './ContextMenu'
export { Popover, PopoverTrigger, PopoverClose, PopoverContent } from './Popover'
export { TabList, Tab } from './Tabs'
export { Toaster, toast, type ToastTone } from './Toast'
