import React, { useState } from "react"
import { useGlobalContext } from "../provider/GlobalProvider"
import { DisplayPriceInRupees } from "../utils/DisplayPriceInRupees"
import AddAddress from "../components/AddAddress"
import { useDispatch, useSelector } from "react-redux"
import { setSelectedAddress } from "../store/addressSlice"
import AxiosToastError from "../utils/AxiosToastError"
import Axios from "../utils/Axios"
import SummaryApi from "../common/SummaryApi"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import { loadStripe } from "@stripe/stripe-js"

const CheckoutPage = () => {
  const {
    notDiscountTotalPrice,
    totalPrice,
    totalQty,
    fetchCartItem,
    fetchOrder,
  } = useGlobalContext()
  const [openAddress, setOpenAddress] = useState(false)
  const addressList = useSelector((state) => state.addresses.addressList)
  const selectedAddressId = useSelector(
    (state) => state.addresses.selectedAddressId
  )
  const cartItemsList = useSelector((state) => state.cartItem.cart)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  // only an active (not deleted) saved address counts as a valid selection
  const getSelectedAddress = () =>
    addressList.find(
      (address) => address._id === selectedAddressId && address.status
    )

  const handleCashOnDelivery = async () => {
    // address selection is compulsory before placing an order
    const selectedAddress = getSelectedAddress()
    if (!selectedAddress) {
      toast.error("Please select a delivery address before placing the order")
      return
    }

    try {
      const response = await Axios({
        ...SummaryApi.CashOnDeliveryOrder,
        data: {
          list_items: cartItemsList,
          addressId: selectedAddress._id,
          subTotalAmt: totalPrice,
          totalAmt: totalPrice,
        },
      })

      const { data: responseData } = response

      if (responseData.success) {
        toast.success(responseData.message)
        if (fetchCartItem) {
          fetchCartItem()
        }
        if (fetchOrder) {
          fetchOrder()
        }
        navigate("/success", {
          state: {
            text: "Order",
          },
        })
      }
    } catch (error) {
      AxiosToastError(error)
    }
  }

  const handleOnlinePayment = async () => {
    try {
      // address selection is compulsory before placing an order
      const selectedAddress = getSelectedAddress()
      if (!selectedAddress) {
        toast.error("Please select a delivery address before placing the order")
        return
      }

      toast.loading("Loading...")
      const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY
      const stripePromise = await loadStripe(stripePublicKey)

      const response = await Axios({
        ...SummaryApi.payment_url,
        data: {
          list_items: cartItemsList,
          addressId: selectedAddress._id,
          subTotalAmt: totalPrice,
          totalAmt: totalPrice,
          // Add customer details for India export compliance
          customer: {
            name: selectedAddress.name || "Customer", // Add name field to your address model if not present
            address: {
              line1: selectedAddress.address_line,
              city: selectedAddress.city,
              state: selectedAddress.state,
              postal_code: selectedAddress.pincode,
              country: selectedAddress.country,
            },
            phone: selectedAddress.mobile,
          },
        },
      })

      const { data: responseData } = response

      if (responseData.id) {
        stripePromise.redirectToCheckout({ sessionId: responseData.id })

        if (fetchCartItem) {
          fetchCartItem()
        }
        if (fetchOrder) {
          fetchOrder()
        }
      } else {
        toast.error("Payment initialization failed")
      }
    } catch (error) {
      toast.dismiss() // Clear loading toast
      AxiosToastError(error)
    }
  }

  const handleRazorpayPayment = async () => {
    try {
      // address selection is compulsory before placing an order
      const selectedAddress = getSelectedAddress()
      if (!selectedAddress) {
        toast.error("Please select a delivery address before placing the order")
        return
      }

      toast.loading("Initializing payment...")

      // Create Razorpay order
      const response = await Axios({
        ...SummaryApi.createRazorpayOrder,
        data: {
          list_items: cartItemsList,
          addressId: selectedAddress._id,
          subTotalAmt: totalPrice,
          totalAmt: totalPrice,
          customer: {
            name: selectedAddress.name || "Customer",
            address: {
              line1: selectedAddress.address_line,
              city: selectedAddress.city,
              state: selectedAddress.state,
              postal_code: selectedAddress.pincode,
              country: selectedAddress.country,
            },
            phone: selectedAddress.mobile,
          },
        },
      })

      const { data: responseData } = response

      if (responseData.success) {
        toast.dismiss()
        
        const options = {
          key: responseData.key_id,
          amount: responseData.order.amount,
          currency: responseData.order.currency,
          name: "Flipkart Clone",
          description: "Payment for your order",
          order_id: responseData.order.id,
          handler: async function (response) {
            try {
              // Verify payment
              const verifyResponse = await Axios({
                ...SummaryApi.verifyRazorpayPayment,
                data: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  list_items: cartItemsList,
                  addressId: selectedAddress._id,
                },
              })

              if (verifyResponse.data.success) {
                toast.success("Payment successful!")
                if (fetchCartItem) {
                  fetchCartItem()
                }
                if (fetchOrder) {
                  fetchOrder()
                }
                navigate("/success", {
                  state: {
                    text: "Order",
                  },
                })
              }
            } catch (error) {
              AxiosToastError(error)
            }
          },
          prefill: {
            name: selectedAddress.name || "Customer",
            email: "",
            contact: selectedAddress.mobile,
          },
          notes: {
            address: selectedAddress.address_line,
          },
          theme: {
            color: "#3399cc",
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.open()
      } else {
        toast.dismiss()
        toast.error("Failed to initialize payment")
      }
    } catch (error) {
      toast.dismiss()
      AxiosToastError(error)
    }
  }

  return (
    <section className="bg-blue-50">
      <div className="container mx-auto p-4 flex flex-col lg:flex-row w-full gap-5 justify-between">
        <div className="w-full">
          {/***address***/}
          <h3 className="text-lg font-semibold">Choose your address</h3>
          <div className="bg-white p-2 grid gap-4">
            {addressList.map((address, index) => {
              const isSelected = address._id === selectedAddressId
              return (
                <label
                  htmlFor={"address" + index}
                  className={!address.status ? "hidden" : "cursor-pointer"}
                  key={address._id || index}
                >
                  <div
                    className={`border rounded p-3 flex gap-3 hover:bg-blue-50 ${
                      isSelected ? "border-blue-600 border-2 bg-blue-50" : ""
                    }`}
                  >
                    <div>
                      <input
                        id={"address" + index}
                        type="radio"
                        checked={isSelected}
                        onChange={() =>
                          dispatch(setSelectedAddress(address._id))
                        }
                        name="address"
                      />
                    </div>
                    <div>
                      {isSelected && (
                        <p className="text-xs font-semibold text-blue-600 mb-1">
                          Current Address
                        </p>
                      )}
                      <p>{address.address_line}</p>
                      <p>{address.city}</p>
                      <p>{address.state}</p>
                      <p>
                        {address.country} - {address.pincode}
                      </p>
                      <p>{address.mobile}</p>
                    </div>
                  </div>
                </label>
              )
            })}
            {!addressList.some((address) => address.status) && (
              <p className="text-sm text-red-500">
                No saved address found. Please add a delivery address to place
                your order.
              </p>
            )}
            <div
              onClick={() => setOpenAddress(true)}
              className="h-16 bg-blue-50 border-2 border-dashed flex justify-center items-center cursor-pointer"
            >
              Add address
            </div>
          </div>
        </div>

        <div className="w-full max-w-md bg-white py-4 px-2">
          {/**summary**/}
          <h3 className="text-lg font-semibold">Summary</h3>
          <div className="bg-white p-4">
            <h3 className="font-semibold">Bill details</h3>
            <div className="flex gap-4 justify-between ml-1">
              <p>Items total</p>
              <p className="flex items-center gap-2">
                <span className="line-through text-neutral-400">
                  {DisplayPriceInRupees(notDiscountTotalPrice)}
                </span>
                <span>{DisplayPriceInRupees(totalPrice)}</span>
              </p>
            </div>
            <div className="flex gap-4 justify-between ml-1">
              <p>Quntity total</p>
              <p className="flex items-center gap-2">{totalQty} item</p>
            </div>
            <div className="flex gap-4 justify-between ml-1">
              <p>Delivery Charge</p>
              <p className="flex items-center gap-2">Free</p>
            </div>
            <div className="font-semibold flex items-center justify-between gap-4">
              <p>Grand total</p>
              <p>{DisplayPriceInRupees(totalPrice)}</p>
            </div>
          </div>
          <div className="w-full flex flex-col gap-4">
            <button
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold"
              onClick={handleRazorpayPayment}
            >
              Pay with Razorpay
            </button>
            
            <button
              className="py-2 px-4 bg-green-600 hover:bg-green-700 rounded text-white font-semibold"
              onClick={handleOnlinePayment}
            >
              Pay with Stripe
            </button>

            <button
              className="py-2 px-4 border-2 border-green-600 font-semibold text-green-600 hover:bg-green-600 hover:text-white"
              onClick={handleCashOnDelivery}
            >
              Cash on Delivery
            </button>
          </div>
        </div>
      </div>

      {openAddress && <AddAddress close={() => setOpenAddress(false)} />}
    </section>
  )
}

export default CheckoutPage
