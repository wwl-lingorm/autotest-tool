import React from 'react'

export default function Button({ children, onClick, variant = 'primary', ...rest }) {
  const cls = `btn ${variant}`
  return (
    <button className={cls} onClick={onClick} {...rest}>
      {children}
    </button>
  )
}
