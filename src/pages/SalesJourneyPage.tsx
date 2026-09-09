import { useReducer } from 'react'
import { PageHeader } from '../components'
import BillingStep from './SalesJourney/BillingStep'
import CustomerStep from './SalesJourney/CustomerStep'
import ProductStep from './SalesJourney/ProductStep'
import ReviewStep from './SalesJourney/ReviewStep'
import { initialState, reducer } from './SalesJourney/state'
import StepIndicator from './SalesJourney/StepIndicator'
import SuccessStep from './SalesJourney/SuccessStep'
import type { StepIndex } from './SalesJourney/types'
import { useSaleCalculation } from './SalesJourney/useSaleCalculation'

export default function SalesJourneyPage() {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Fetches the sales policy once, then keeps `state.calculation` in sync
  // with the cart/customer/billing type for every step in the wizard.
  useSaleCalculation(state, dispatch)

  function goToStep(step: StepIndex) {
    dispatch({ type: 'SET_STEP', step })
  }

  return (
    <div className="flex flex-col gap-5">
      {state.step !== 4 && (
        <>
          <PageHeader title="New sale" description="Select products, add the customer, then take payment." />
          <StepIndicator currentStep={state.step} maxStepReached={state.maxStepReached} onJump={goToStep} />
        </>
      )}

      {state.step === 0 && (
        <ProductStep state={state} dispatch={dispatch} onContinue={() => goToStep(1)} />
      )}
      {state.step === 1 && (
        <CustomerStep
          state={state}
          dispatch={dispatch}
          onContinue={() => goToStep(2)}
          onBack={() => goToStep(0)}
        />
      )}
      {state.step === 2 && (
        <BillingStep
          state={state}
          dispatch={dispatch}
          onContinue={() => goToStep(3)}
          onBack={() => goToStep(1)}
        />
      )}
      {state.step === 3 && (
        <ReviewStep
          state={state}
          dispatch={dispatch}
          onEditProducts={() => goToStep(0)}
          onEditCustomer={() => goToStep(1)}
          onEditBilling={() => goToStep(2)}
          onBack={() => goToStep(2)}
        />
      )}
      {state.step === 4 && (
        <SuccessStep state={state} onStartNewSale={() => dispatch({ type: 'RESET' })} />
      )}
    </div>
  )
}
