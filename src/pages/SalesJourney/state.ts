import type {
  CartLine,
  CheckoutResult,
  CommPref,
  Customer,
  PaymentMethod,
  Product,
  StepIndex,
} from './types'

export interface WizardState {
  step: StepIndex
  maxStepReached: StepIndex
  cart: CartLine[]
  customer: Customer | null
  billingAddress: string
  communicationPreferences: CommPref[]
  orderDiscount: string
  paymentMethod: PaymentMethod
  amountPaid: string
  amountPaidTouched: boolean
  notes: string
  checkoutError: string | null
  isSubmitting: boolean
  result: CheckoutResult | null
}

export const initialState: WizardState = {
  step: 0,
  maxStepReached: 0,
  cart: [],
  customer: null,
  billingAddress: '',
  communicationPreferences: [],
  orderDiscount: '',
  paymentMethod: 'cash',
  amountPaid: '',
  amountPaidTouched: false,
  notes: '',
  checkoutError: null,
  isSubmitting: false,
  result: null,
}

export type Action =
  | { type: 'SET_STEP'; step: StepIndex }
  | { type: 'ADD_OR_BUMP_CART_LINE'; product: Product }
  | { type: 'UPDATE_CART_LINE'; productId: string; patch: Partial<Pick<CartLine, 'quantity' | 'discount'>> }
  | { type: 'REMOVE_CART_LINE'; productId: string }
  | { type: 'SET_CUSTOMER'; customer: Customer }
  | { type: 'CHANGE_CUSTOMER' }
  | { type: 'SET_BILLING_ADDRESS'; value: string }
  | { type: 'TOGGLE_COMM_PREF'; pref: CommPref }
  | { type: 'SET_ORDER_DISCOUNT'; value: string }
  | { type: 'SET_PAYMENT_METHOD'; value: PaymentMethod }
  | { type: 'SET_AMOUNT_PAID'; value: string }
  | { type: 'SET_AMOUNT_PAID_AUTO'; value: string }
  | { type: 'SET_NOTES'; value: string }
  | { type: 'CHECKOUT_START' }
  | { type: 'CHECKOUT_ERROR'; message: string }
  | { type: 'CHECKOUT_SUCCESS'; result: CheckoutResult }
  | { type: 'RESET' }

export function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        step: action.step,
        maxStepReached: (Math.max(state.maxStepReached, action.step) as StepIndex),
      }

    case 'ADD_OR_BUMP_CART_LINE': {
      const { product } = action
      if (product.level === 'red') return state
      const existingIndex = state.cart.findIndex((line) => line.productId === product._id)
      if (existingIndex >= 0) {
        const existing = state.cart[existingIndex]
        const nextCart = [...state.cart]
        nextCart[existingIndex] = {
          ...existing,
          availableQuantity: product.quantity,
          quantity: Math.min(product.quantity, existing.quantity + 1),
        }
        return { ...state, cart: nextCart }
      }
      const newLine: CartLine = {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        metalType: product.metalType,
        purity: product.purity,
        category: product.category,
        unitPrice: product.price?.finalPrice ?? null,
        unitTax: product.price?.tax ?? 0,
        availableQuantity: product.quantity,
        quantity: 1,
        discount: 0,
      }
      return { ...state, cart: [...state.cart, newLine] }
    }

    case 'UPDATE_CART_LINE': {
      return {
        ...state,
        cart: state.cart.map((line) => {
          if (line.productId !== action.productId) return line
          const next = { ...line }
          if (action.patch.quantity !== undefined) {
            next.quantity = Math.max(1, Math.min(action.patch.quantity, line.availableQuantity))
          }
          if (action.patch.discount !== undefined) {
            next.discount = Math.max(0, action.patch.discount)
          }
          return next
        }),
      }
    }

    case 'REMOVE_CART_LINE':
      return { ...state, cart: state.cart.filter((line) => line.productId !== action.productId) }

    case 'SET_CUSTOMER': {
      const { customer } = action
      return {
        ...state,
        customer,
        billingAddress: customer.billingAddress || customer.address || '',
        communicationPreferences: customer.communicationPreferences ?? [],
      }
    }

    case 'CHANGE_CUSTOMER':
      return { ...state, customer: null }

    case 'SET_BILLING_ADDRESS':
      return { ...state, billingAddress: action.value }

    case 'TOGGLE_COMM_PREF': {
      const has = state.communicationPreferences.includes(action.pref)
      return {
        ...state,
        communicationPreferences: has
          ? state.communicationPreferences.filter((pref) => pref !== action.pref)
          : [...state.communicationPreferences, action.pref],
      }
    }

    case 'SET_ORDER_DISCOUNT':
      return { ...state, orderDiscount: action.value }

    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.value }

    case 'SET_AMOUNT_PAID':
      return { ...state, amountPaid: action.value, amountPaidTouched: true }

    case 'SET_AMOUNT_PAID_AUTO':
      return { ...state, amountPaid: action.value }

    case 'SET_NOTES':
      return { ...state, notes: action.value }

    case 'CHECKOUT_START':
      return { ...state, isSubmitting: true, checkoutError: null }

    case 'CHECKOUT_ERROR':
      return { ...state, isSubmitting: false, checkoutError: action.message }

    case 'CHECKOUT_SUCCESS':
      return {
        ...state,
        isSubmitting: false,
        checkoutError: null,
        result: action.result,
        step: 4,
        maxStepReached: 4,
      }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

export function lineTotal(line: CartLine): number {
  if (line.unitPrice == null) return 0
  return Math.max(line.unitPrice * line.quantity - line.discount, 0)
}

export function lineTaxTotal(line: CartLine): number {
  return line.unitTax * line.quantity
}

export function cartSubtotal(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + lineTotal(line), 0)
}

export function grandTotal(cart: CartLine[], orderDiscount: number): number {
  return Math.max(cartSubtotal(cart) - orderDiscount, 0)
}

/**
 * Gross value of a line before any discount — pure scaling of the server's
 * `finalPrice`, never a re-derivation of pricing.
 */
export function lineGross(line: CartLine): number {
  if (line.unitPrice == null) return 0
  return line.unitPrice * line.quantity
}

export function cartGross(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + lineGross(line), 0)
}

export function cartTaxTotal(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + lineTaxTotal(line), 0)
}

export function cartItemCount(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0)
}

/** Order-level discount as a number, tolerating the raw input string. */
export function orderDiscountValue(state: WizardState): number {
  return Number(state.orderDiscount) || 0
}

export function amountPaidValue(state: WizardState): number {
  return Number(state.amountPaid) || 0
}

export function orderTotal(state: WizardState): number {
  return grandTotal(state.cart, orderDiscountValue(state))
}

/** Paying more than the bill is rejected before checkout, as it always was. */
export function isOverpaid(state: WizardState): boolean {
  return amountPaidValue(state) > orderTotal(state)
}
