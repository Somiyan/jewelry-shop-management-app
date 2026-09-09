import type {
  BelowValueApproval,
  BillingType,
  CartLine,
  CheckoutResult,
  CommPref,
  Customer,
  MakingChargeOverride,
  PaymentMethod,
  Product,
  SaleCalculation,
  SalesPolicy,
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

  /** GST or Non-GST for this sale. Any authenticated user may switch it. */
  billingType: BillingType
  /** What this user is allowed to do, fetched once when the wizard starts. */
  salesPolicy: SalesPolicy | null
  /**
   * The latest `/sales/calculate` response. This is the single source of
   * truth for every price shown from the Products step onward — never the
   * client-derived cart totals below, which only exist as a rough estimate
   * before the first calculation resolves.
   */
  calculation: SaleCalculation | null
  isCalculating: boolean
  calculationError: string | null
  /** One blanket approval covering every below-value line in this sale. */
  belowValueApproval: BelowValueApproval | null
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

  billingType: 'GST',
  salesPolicy: null,
  calculation: null,
  isCalculating: false,
  calculationError: null,
  belowValueApproval: null,
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
  /** A 409/403 arrived mid-checkout: stop the spinner without alarming the user — the approval modal takes over. */
  | { type: 'CHECKOUT_NEEDS_APPROVAL' }
  | { type: 'CHECKOUT_SUCCESS'; result: CheckoutResult }
  | { type: 'SET_BILLING_TYPE'; value: BillingType }
  | { type: 'SET_LINE_MAKING_CHARGE'; productId: string; override: MakingChargeOverride | undefined }
  | { type: 'SET_SALES_POLICY'; policy: SalesPolicy }
  | { type: 'CALCULATE_START' }
  | { type: 'CALCULATE_SUCCESS'; calculation: SaleCalculation }
  | { type: 'CALCULATE_ERROR'; message: string }
  | { type: 'CALCULATE_CLEAR' }
  | { type: 'SET_BELOW_VALUE_APPROVAL'; approval: BelowValueApproval | null }
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

    case 'CHECKOUT_NEEDS_APPROVAL':
      return { ...state, isSubmitting: false, checkoutError: null }

    case 'CHECKOUT_SUCCESS':
      return {
        ...state,
        isSubmitting: false,
        checkoutError: null,
        result: action.result,
        step: 4,
        maxStepReached: 4,
      }

    case 'SET_BILLING_TYPE':
      // Switching GST <-> Non-GST recalculates tax only — cart, customer and
      // every other choice made so far are untouched.
      return { ...state, billingType: action.value }

    case 'SET_LINE_MAKING_CHARGE':
      return {
        ...state,
        cart: state.cart.map((line) =>
          line.productId === action.productId ? { ...line, makingChargeOverride: action.override } : line,
        ),
      }

    case 'SET_SALES_POLICY':
      return {
        ...state,
        salesPolicy: action.policy,
        // Only adopt the server default the first time the policy loads —
        // a salesperson's manual GST/Non-GST choice is never overwritten.
        billingType: state.salesPolicy ? state.billingType : action.policy.defaultBillingType,
      }

    case 'CALCULATE_START':
      return { ...state, isCalculating: true, calculationError: null }

    case 'CALCULATE_SUCCESS':
      return {
        ...state,
        isCalculating: false,
        calculationError: null,
        calculation: action.calculation,
        // A below-value approval is tied to the priced lines it covered —
        // any new calculation (cart, making charge or billing type changed)
        // means the approval must be re-confirmed against the new numbers.
        belowValueApproval: null,
      }

    case 'CALCULATE_ERROR':
      return { ...state, isCalculating: false, calculationError: action.message, calculation: null }

    case 'CALCULATE_CLEAR':
      return { ...state, isCalculating: false, calculationError: null, calculation: null }

    case 'SET_BELOW_VALUE_APPROVAL':
      return { ...state, belowValueApproval: action.approval }

    case 'RESET':
      // A fresh sale keeps the policy already fetched (no need to re-fetch)
      // and re-applies its default billing type.
      return {
        ...initialState,
        salesPolicy: state.salesPolicy,
        billingType: state.salesPolicy?.defaultBillingType ?? initialState.billingType,
      }

    default:
      return state
  }
}

/* ------------------------------------------------------- rough estimates ---
 * Pure scaling of prices already frozen on each CartLine at add-to-cart time.
 * These exist ONLY to render something before the first `/sales/calculate`
 * response lands (e.g. the phone cart-summary strip while the debounce timer
 * is still pending) — they must never be shown alongside, or instead of, the
 * calculation-driven totals once a `calculation` exists. See ReviewStep and
 * BillingStep, which read `state.calculation` exclusively.
 * --------------------------------------------------------------------------*/

export function lineTotal(line: CartLine): number {
  if (line.unitPrice == null) return 0
  return Math.max(line.unitPrice * line.quantity - line.discount, 0)
}

export function cartSubtotal(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + lineTotal(line), 0)
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

/**
 * The order total to bill against: the backend's own `grandTotal` once a
 * calculation exists, falling back to the rough client estimate only before
 * the first response lands.
 */
export function orderTotal(state: WizardState): number {
  if (state.calculation) return state.calculation.grandTotal
  return Math.max(cartSubtotal(state.cart) - orderDiscountValue(state), 0)
}

/** Paying more than the bill is rejected before checkout, as it always was. */
export function isOverpaid(state: WizardState): boolean {
  return amountPaidValue(state) > orderTotal(state)
}
