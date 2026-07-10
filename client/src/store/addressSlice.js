import { createSlice } from "@reduxjs/toolkit";

const SELECTED_ADDRESS_KEY = "selectedAddressId"

const initialValue = {
    addressList : [],
    selectedAddressId : localStorage.getItem(SELECTED_ADDRESS_KEY) || null
}

const addressSlice = createSlice({
    name : 'address',
    initialState : initialValue,
    reducers : {
        handleAddAddress : (state,action)=>{
            state.addressList = [...action.payload]

            // keep only a valid & active (not deleted) address selected.
            // if nothing valid is selected, auto-select the first active address
            // so a customer with saved addresses always has one pre-selected.
            const activeAddresses = state.addressList.filter(address => address.status)
            const stillValid = activeAddresses.some(address => address._id === state.selectedAddressId)

            if(!stillValid){
                state.selectedAddressId = activeAddresses[0]?._id || null

                if(state.selectedAddressId){
                    localStorage.setItem(SELECTED_ADDRESS_KEY, state.selectedAddressId)
                }else{
                    localStorage.removeItem(SELECTED_ADDRESS_KEY)
                }
            }
        },
        setSelectedAddress : (state,action)=>{
            state.selectedAddressId = action.payload

            if(action.payload){
                localStorage.setItem(SELECTED_ADDRESS_KEY, action.payload)
            }else{
                localStorage.removeItem(SELECTED_ADDRESS_KEY)
            }
        }
    }
})

export const { handleAddAddress, setSelectedAddress } = addressSlice.actions

export default addressSlice.reducer
