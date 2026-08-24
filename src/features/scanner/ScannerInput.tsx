import { forwardRef } from 'react'

type ScannerInputProps = {
  disabled: boolean
  onChange: (value: string) => void
  value: string
}

export const ScannerInput = forwardRef<HTMLInputElement, ScannerInputProps>(function ScannerInput(
  { disabled, onChange, value },
  ref,
) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-800" htmlFor="microchip-code">
        Código del microchip
      </label>
      <input
        autoComplete="off"
        autoFocus
        className="mt-2 block w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-lg tracking-wide text-stone-950 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-stone-100"
        disabled={disabled}
        id="microchip-code"
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        ref={ref}
        value={value}
      />
    </div>
  )
})
