import { type Dispatch, useEffect, useRef } from 'react'
import { calculateSale, getSalesPolicy } from '../../api/sales'
import { extractErrorMessage } from '../../utils/format'
import type { Action, WizardState } from './state'

const DEBOUNCE_MS = 300

/**
 * Owns the two calls that keep the wizard's pricing honest:
 *  - `GET /sales/policy`, once, when the Sales Journey starts.
 *  - a debounced `POST /sales/calculate`, the single source of truth for
 *    every price shown from the Products step onward, re-run whenever the
 *    cart, a making-charge override, the customer or the billing type
 *    changes.
 *
 * Nothing here computes a price — it only decides *when* to ask the backend
 * for one.
 */
export function useSaleCalculation(state: WizardState, dispatch: Dispatch<Action>) {
  const policyRequested = useRef(false)

  useEffect(() => {
    if (policyRequested.current) return
    policyRequested.current = true
    getSalesPolicy()
      .then((policy) => dispatch({ type: 'SET_SALES_POLICY', policy }))
      .catch(() => {
        // The Billing step falls back to a plain GST/Non-GST choice with
        // making-charge adjustment disabled if the policy never arrives —
        // handled by the null-check on `salesPolicy` at each call site.
      })
  }, [dispatch])

  // A stable key for "does the priced part of the cart actually need a new
  // calculation" — quantity, discount and making-charge override only.
  // Anything else on a CartLine (name, sku, availableQuantity…) is display
  // metadata and must not retrigger a network call.
  const cartKey = JSON.stringify(
    state.cart.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      discount: line.discount || undefined,
      makingChargeOverride: line.makingChargeOverride,
    })),
  )
  const discount = Number(state.orderDiscount) || 0

  useEffect(() => {
    if (state.cart.length === 0) {
      dispatch({ type: 'CALCULATE_CLEAR' })
      return undefined
    }

    let cancelled = false
    dispatch({ type: 'CALCULATE_START' })

    const handle = setTimeout(() => {
      calculateSale({
        items: state.cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discount: line.discount || undefined,
          makingChargeOverride: line.makingChargeOverride,
        })),
        billingType: state.billingType,
        customerId: state.customer?._id,
        discount: discount || undefined,
      })
        .then((calculation) => {
          if (cancelled) return
          dispatch({ type: 'CALCULATE_SUCCESS', calculation })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          dispatch({ type: 'CALCULATE_ERROR', message: extractErrorMessage(err) })
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
    // Deliberately keyed on `cartKey` (a derived string), not `state.cart`
    // itself — a new array identity on every render must not retrigger this.
  }, [cartKey, state.billingType, state.customer?._id, discount, dispatch])
}
