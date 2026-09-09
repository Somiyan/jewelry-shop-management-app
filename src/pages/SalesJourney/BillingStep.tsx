import { type Dispatch, useEffect } from 'react'
import { AlertIcon, Card, Checkbox, Field, FigureStack, Input, Select, Skeleton, Textarea } from '../../components'
import { formatCurrency } from '../../utils/format'
import ActionBar from './ActionBar'
import { BILLING_TYPES } from './pricing-format'
import { amountPaidValue, isOverpaid, orderTotal, type Action, type WizardState } from './state'
import TabToggle from './TabToggle'
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
  const { calculation, isCalculating, calculationError } = state
  const grandTotal = orderTotal(state)
  const amountPaid = amountPaidValue(state)
  const balanceDue = grandTotal - amountPaid
  const overpaid = isOverpaid(state)

  useEffect(() => {
    // Only re-sync automatically while the salesperson hasn't manually edited the field.
    if (!state.amountPaidTouched) {
      dispatch({ type: 'SET_AMOUNT_PAID_AUTO', value: String(grandTotal) })
    }
  }, [grandTotal, state.amountPaidTouched, dispatch])

  const canContinue = !!state.paymentMethod && amountPaid >= 0 && !overpaid

  return (
    <div className="space-y-4">
      <Card
        title="Billing type"
        description="Switching only changes the tax on this sale — the cart, customer and everything else stay as they are."
      >
        <TabToggle
          label="Billing type"
          value={state.billingType}
          onChange={(value) => dispatch({ type: 'SET_BILLING_TYPE', value })}
          options={BILLING_TYPES}
        />
      </Card>

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

        <div className="mt-4 rounded-panel bg-sunken p-3 sm:p-4" aria-live="polite">
          {calculation ? (
            <FigureStack
              rows={[
                { label: 'Gold value', value: calculation.productValueTotal },
                { label: 'Making charges', value: calculation.makingChargeTotal },
                ...(calculation.lineDiscountTotal > 0
                  ? [{ label: 'Line discounts', value: -calculation.lineDiscountTotal, tone: 'success' as const }]
                  : []),
                ...(calculation.orderDiscount > 0
                  ? [{ label: 'Order discount', value: -calculation.orderDiscount, tone: 'success' as const }]
                  : []),
                calculation.billingType === 'GST'
                  ? calculation.isInterState
                    ? { label: 'IGST', value: calculation.igstAmount }
                    : { label: 'CGST + SGST', value: calculation.cgstAmount + calculation.sgstAmount }
                  : { label: 'GST', value: 'Not applicable' },
              ]}
              total={{ label: 'Order total', value: calculation.grandTotal }}
            />
          ) : calculationError ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-danger">
              <AlertIcon size={16} className="mt-0.5 shrink-0" />
              {calculationError}
            </p>
          ) : (
            <div className="space-y-2" aria-busy={isCalculating}>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          )}
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
