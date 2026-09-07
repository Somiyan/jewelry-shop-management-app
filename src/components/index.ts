/**
 * The design system. Import from here, never from the individual files:
 *   import { Button, DataTable, useToast } from '../components'
 *
 * Do not hand-roll a variant of one of these inside a page — extend the
 * component instead. See DESIGN.md for the rules these encode.
 */

export { Badge, type BadgeProps, type BadgeTone } from './Badge'
export { Button, type ButtonProps } from './Button'
export { buttonClass, type ButtonSize, type ButtonVariant } from './button-styles'
export { Card, type CardProps } from './Card'
export { Checkbox, type CheckboxProps } from './Checkbox'
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog'
export {
  DataTable,
  type Column,
  type ColumnAlign,
  type DataTableProps,
  type SortDirection,
} from './DataTable'
export { Drawer, type DrawerProps, type DrawerSize } from './Drawer'
export { EmptyState, type EmptyStateProps } from './EmptyState'
export { Field, type FieldProps } from './Field'
export { FigureStack, type FigureRow, type FigureStackProps } from './FigureStack'
export { IconButton, type IconButtonProps } from './IconButton'
export { Input, type InputProps } from './Input'
export { MetalSwatch, type MetalSwatchProps } from './MetalSwatch'
export { Modal, type ModalProps, type ModalSize } from './Modal'
export { PageHeader, type Breadcrumb, type PageHeaderProps } from './PageHeader'
export { Pagination, type PaginationProps } from './Pagination'
export { SearchInput, type SearchInputProps } from './SearchInput'
export { Select, type SelectOption, type SelectProps } from './Select'
export {
  Skeleton,
  SkeletonCard,
  SkeletonRow,
  SkeletonText,
  type SkeletonProps,
} from './Skeleton'
export { Spinner, type SpinnerProps } from './Spinner'
export { StatCard, type StatCardProps, type StatDelta } from './StatCard'
export { Tabs, type TabItem, type TabsProps } from './Tabs'
export { Textarea, type TextareaProps } from './Textarea'
export { ToastProvider } from './ToastProvider'
export { useToast, type Toast, type ToastApi, type ToastTone } from './toast-context'
export { paginate, pageCount } from '../utils/paginate'
export { cx } from '../utils/cx'
export * from './icons'
