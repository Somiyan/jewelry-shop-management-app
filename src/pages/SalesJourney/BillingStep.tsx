import { type Dispatch, useEffect } from 'react'
import { Card, Checkbox, Field, FigureStack, Input, Select, Textarea } from '../../components'
import { formatCurrency } from '../../utils/format'
import ActionBar from './ActionBar'
import { cartSubtotal, type Action, type WizardState } from './state'
import type { CommPref, PaymentMethod } from './types'

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

const COMM_PREFS: { value: CommPref; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

interface Props {
  state: WizardState
  dispatch: Dispatch<Action>
  onContinue: () => void
  onBack: () => void
}

export default function BillingStep({ state, dispatch, onContinue, onBack }: Props) {
  const subtotal = cartSubtotal(state.cart)
  const orderDiscount = Number(state.orderDiscount) || 0
  const grandTotal = Math.max(subtotal - orderDiscount, 0)
  const amountPaid = Number(state.amountPaid) || 0
  const balanceDue = grandTotal - amountPaid
  const overpaid = amountPaid > grandTotal

  useEffect(() => {
    // Only re-sync automatically while the salesperson hasn't manually edited the field.
    if (!state.amountPaidTouched) {
      dispatch({ type: 'SET_AMOUNT_PAID_AUTO', value: String(grandTotal) })
    }
  }, [grandTotal, state.amountPaidTouched, dispatch])

  const canContinue = !!state.paymentMethod && amountPaid >= 0 && !overpaid

  return (
    <div className="space-y-4">
      <Card title="Billing details">
        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <span className="text-sm text-ink-muted">Billed to</span>
            <span className="text-right text-sm font-medium text-ink">{state.customer?.name}</span>
          </div>

          <Field
            label="Billing address"
            hint="Used on this invoice only. The customer's saved profile is not changed."
          >
            <Textarea
              rows={2}
              value={state.billingAddress}
              onChange={(event) =>
                dispatch({ type: 'SET_BILLING_ADDRESS', value: event.target.value })
              }
            />
          </Field>

          <Field
            label="Order discount"
            hint="Flat amount off the whole bill, on top of any line discounts. Optional."
            className="sm:max-w-xs"
          >
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={state.orderDiscount}
              onChange={(event) => dispatch({ type: 'SET_ORDER_DISCOUNT', value: event.target.value })}
              className="text-right font-mono"
            />
          </Field>
        </div>
      </Card>

      <Card title="Communication" description="How this invoice should reach the customer.">
        <fieldset>
          <legend className="sr-only">Send invoice via</legend>
          <div className="flex flex-wrap gap-x-6">
            {COMM_PREFS.map((pref) => (
              <Checkbox
                key={pref.value}
                label={pref.label}
                checked={state.communicationPreferences.includes(pref.value)}
                onChange={() => dispatch({ type: 'TOGGLE_COMM_PREF', pref: pref.value })}
              />
            ))}
          </div>
        </fieldset>
      </Card>

      <Card title="Payment">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Payment method" required>
            <Select
              value={state.paymentMethod}
              onChange={(event) =>
                dispatch({ type: 'SET_PAYMENT_METHOD', value: event.target.value as PaymentMethod })
              }
              options={PAYMENT_METHODS}
            />
          </Field>
          <Field
            label="Amount paid"
            required
            error={overpaid ? 'Amount paid cannot exceed the order total.' : undefined}
            hint={
              !overpaid && balanceDue > 0
                ? `Balance of ${formatCurrency(balanceDue)} will be recorded as due.`
                : !overpaid && balanceDue === 0
                  ? 'Paid in full.'
                  : undefined
            }
          >
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={state.amountPaid}
              onChange={(event) => dispatch({ type: 'SET_AMOUNT_PAID', value: event.target.value })}
              className="text-right font-mono"
            />
          </Field>
          <Field label="Notes" hint="Optional. Printed on the invoice." className="sm:col-span-2">
            <Input
              value={state.notes}
              onChange={(event) => dispatch({ type: 'SET_NOTES', value: event.target.value })}
            />
          </Field>
        </div>

        <div className="mt-4 rounded-panel bg-sunken p-3 sm:p-4">
          <FigureStack
            rows={[
              { label: 'Cart subtotal', value: subtotal },
              ...(orderDiscount > 0
                ? [{ label: 'Order discount', value: -orderDiscount, tone: 'success' as const }]
                : []),
            ]}
            total={{ label: 'Order total', value: grandTotal }}
          />
          <div className="mt-3 border-t border-line pt-3">
            <FigureStack
              size="sm"
              rows={[
                { label: 'Amount paid', value: amountPaid },
                {
                  label: overpaid ? 'Overpaid by' : 'Balance due',
                  value: overpaid ? -balanceDue : balanceDue,
                  tone: overpaid ? 'danger' : balanceDue > 0 ? 'default' : 'success',
                },
              ]}
            />
          </div>
        </div>
      </Card>

      <ActionBar
        back={{ label: 'Back', onClick: onBack }}
        primary={{ label: 'Continue to review', onClick: onContinue, disabled: !canContinue }}
        message={
          overpaid ? (
            <p role="alert" className="text-sm text-danger">
              Amount paid cannot exceed the order total.
            </p>
          ) : undefined
        }
      />
    </div>
  )
}
