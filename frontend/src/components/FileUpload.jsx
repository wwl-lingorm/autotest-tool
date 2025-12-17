import React from 'react'

export default function FileUpload({ onFile }) {
  function onChange(e) {
    const f = e.target.files && e.target.files[0]
    if (f && onFile) onFile(f)
  }

  return (
    <input type="file" accept="image/*" onChange={onChange} />
  )
}
