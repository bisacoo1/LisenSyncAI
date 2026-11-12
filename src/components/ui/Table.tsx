import React from 'react'

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ children, className = '', style, ...props }, ref) => {
    return (
      <table
        ref={ref}
        className={className}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
          ...style,
        }}
        {...props}
      >
        {children}
      </table>
    )
  }
)

Table.displayName = 'Table'

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '', style, ...props }) => {
  return (
    <thead className={className} style={{ ...style }} {...props}>
      {children}
    </thead>
  )
}

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

export const TableBody: React.FC<TableBodyProps> = ({ children, className = '', style, ...props }) => {
  return (
    <tbody className={className} style={{ ...style }} {...props}>
      {children}
    </tbody>
  )
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ children, className = '', style, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={className}
        style={{
          transition: 'background 150ms ease',
          ...style,
        }}
        {...props}
      >
        {children}
      </tr>
    )
  }
)

TableRow.displayName = 'TableRow'

export interface TableCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ children, className = '', style, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={className}
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          verticalAlign: 'middle',
          ...style,
        }}
        {...props}
      >
        {children}
      </td>
    )
  }
)

TableCell.displayName = 'TableCell'

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ children, className = '', style, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={className}
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          fontWeight: 600,
          color: 'var(--muted)',
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          textAlign: 'left',
          verticalAlign: 'middle',
          ...style,
        }}
        {...props}
      >
        {children}
      </th>
    )
  }
)

TableHead.displayName = 'TableHead'

export default Table