"use client"

import { ReactNode } from 'react'

interface Column<T> {
  header: string
  accessor: keyof T
  render?: (item: T) => ReactNode
}

interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  className?: string
}

interface TableRowProps {
  children: ReactNode
  className?: string
}

interface TableCellProps {
  children: ReactNode
  className?: string
}

export function Table<T>({ data = [], columns = [], className = "" }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      {data.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-lg font-medium">Нет данных для отображения</p>
          <p className="text-sm text-gray-400 mt-2">Попробуйте изменить фильтры или обновить страницу</p>
        </div>
      ) : (
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
             {data.map((item, rowIndex) => (
               <tr key={rowIndex} className="hover:bg-blue-50 transition-colors duration-200 border-b border-gray-100">
                 {columns.map((column, colIndex) => (
                   <td
                     key={colIndex}
                     className="px-3 md:px-6 py-3 md:py-5 text-xs md:text-sm text-gray-900 align-top"
                   >
                     {column.render ? column.render(item) : String(item[column.accessor] || '')}
                   </td>
                 ))}
               </tr>
             ))}
           </tbody>
        </table>
      )}
    </div>
  )
}

export function TableRow({ children, className = "" }: TableRowProps) {
  return (
    <tr className={`hover:bg-gray-50 ${className}`}>
      {children}
    </tr>
  )
}

export function TableCell({ children, className = "" }: TableCellProps) {
  return (
    <td className={`px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-900 ${className}`}>
      {children}
    </td>
  )
}
