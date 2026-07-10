import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { FiDownload } from 'react-icons/fi'
import NoData from '../components/NoData'
import Axios from '../utils/Axios'
import SummaryApi from '../common/SummaryApi'
import { DisplayPriceInRupees } from '../utils/DisplayPriceInRupees'

const MyOrders = () => {
  const orders = useSelector(state => state.orders.order) || []
  const [downloadingId, setDownloadingId] = useState(null)

  const formatDate = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase()

    if (s.includes('CASH')) {
      return (
        <span className='text-xs font-semibold px-2 py-1 rounded bg-amber-100 text-amber-700'>
          Cash on Delivery
        </span>
      )
    }
    if (s === 'PAID') {
      return (
        <span className='text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-700'>
          Paid
        </span>
      )
    }
    return (
      <span className='text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-600'>
        {status || 'Pending'}
      </span>
    )
  }

  const getAddressText = (address) => {
    if (!address) return ''
    return [
      address.address_line,
      address.city,
      address.state,
      address.pincode,
    ]
      .filter(Boolean)
      .join(', ')
  }

  const handleDownloadInvoice = async (order) => {
    try {
      setDownloadingId(order._id)

      const response = await Axios({
        url: `${SummaryApi.downloadInvoice.url}/${order.orderId}`,
        method: SummaryApi.downloadInvoice.method,
        responseType: 'blob',
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Invoice-${order.orderId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('Invoice downloaded')
    } catch (error) {
      console.log(error)
      toast.error('Failed to download invoice. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div>
      <div className='bg-white shadow-md p-3 font-semibold'>
        <h1>My Orders</h1>
      </div>

      {
        !orders[0] && (
          <NoData />
        )
      }

      <div className='grid gap-3 p-3'>
        {
          orders.map((order, index) => {
            return (
              <div
                key={order._id + index + 'order'}
                className='bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-sm'
              >
                {/* top row : order no + date | status */}
                <div className='flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-gray-100'>
                  <div>
                    <p className='font-semibold text-gray-800'>
                      Order No : <span className='font-normal text-gray-600'>{order?.orderId}</span>
                    </p>
                    <p className='text-xs text-gray-500 mt-1'>
                      Placed on {formatDate(order?.createdAt)}
                    </p>
                  </div>
                  {getStatusBadge(order?.payment_status)}
                </div>

                {/* product row */}
                <div className='flex items-center gap-3 py-3'>
                  <img
                    src={order?.product_details?.image?.[0]}
                    alt={order?.product_details?.name}
                    className='w-14 h-14 object-scale-down border rounded bg-gray-50'
                  />
                  <div className='flex-1 min-w-0'>
                    <p className='font-medium text-gray-800 line-clamp-2'>
                      {order?.product_details?.name}
                    </p>
                  </div>
                  <p className='font-semibold text-gray-800 whitespace-nowrap'>
                    {DisplayPriceInRupees(order?.totalAmt)}
                  </p>
                </div>

                {/* address */}
                {
                  order?.delivery_address && (
                    <p className='text-xs text-gray-500 pb-3'>
                      <span className='font-semibold text-gray-600'>Deliver to : </span>
                      {getAddressText(order.delivery_address)}
                    </p>
                  )
                }

                {/* actions */}
                <div className='flex justify-end pt-3 border-t border-gray-100'>
                  <button
                    onClick={() => handleDownloadInvoice(order)}
                    disabled={downloadingId === order._id}
                    className='flex items-center gap-2 px-3 py-1.5 rounded border border-blue-600 text-blue-600 font-medium text-xs hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    <FiDownload size={14} />
                    {downloadingId === order._id ? 'Downloading...' : 'Download Invoice'}
                  </button>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

export default MyOrders
