import { registerBidder } from '../src/adapters/bidderFactory.js';
import { BANNER, VIDEO } from '../src/mediaTypes.js';
import { ortbConverter } from '../libraries/ortbConverter/converter.js'
import { deepSetValue } from '../src/utils.js';

const VERSION = '1.0.0';

const BIDDER_CODE = 'kimberlite';
const METHOD = 'POST';
export const ENDPOINT_URL = 'https://kimberlite.io/rtb/bid/pbjs';

const VERSION_INFO = {
  ver: '$prebid.version$',
  adapterVer: `${VERSION}`
};

const converter = ortbConverter({
  context: {
    netRevenue: true,
    ttl: 300
  },

  request(buildRequest, imps, bidderRequest, context) {
    const bidRequest = buildRequest(imps, bidderRequest, context);
    deepSetValue(bidRequest, 'site.publisher.domain', bidderRequest.refererInfo.domain);
    deepSetValue(bidRequest, 'site.page', bidderRequest.refererInfo.page);
    deepSetValue(bidRequest, 'ext.prebid.ver', VERSION_INFO.ver);
    deepSetValue(bidRequest, 'ext.prebid.adapterVer', VERSION_INFO.adapterVer);
    bidRequest.at = 1;
    return bidRequest;
  },

  imp (buildImp, bidRequest, context) {
    const imp = buildImp(bidRequest, context);
    imp.tagid = bidRequest.params.placementId;
    const mediaTypes = bidRequest.mediaTypes;
    if (imp[VIDEO]) {
      deepSetValue(imp, 'video.linearity', mediaTypes[VIDEO].linearity || 1);
      deepSetValue(imp, 'video.protocols', mediaTypes[VIDEO].protocols || [3, 6]);
      deepSetValue(imp, 'video.placement', mediaTypes[VIDEO].placement || 1);
      deepSetValue(imp, 'video.startdelay', mediaTypes[VIDEO].startdelay || 0);
    }
    return imp;
  },

  bidResponse: function (buildBidResponse, bid, context) {
    if (!bid.price) return;

    const [type] = Object.keys(context.bidRequest.mediaTypes);
    context.mediaType = type;

    const bidResponse = buildBidResponse(bid, context);
    return bidResponse;
  },
});

export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: [BANNER, VIDEO],

  isBidRequestValid: (bidRequest = {}) => {
    const { params, mediaTypes } = bidRequest;
    let isValid = Boolean(params && params.placementId);
    if (mediaTypes && mediaTypes[BANNER]) {
      isValid = isValid && Boolean(mediaTypes[BANNER].sizes);
    } else if (mediaTypes && mediaTypes[VIDEO]) {
      isValid = isValid && Boolean(mediaTypes[VIDEO].mimes);
    } else {
      isValid = false;
    }

    return isValid;
  },

  buildRequests: function (bidRequests, bidderRequest) {
    return {
      method: METHOD,
      url: ENDPOINT_URL,
      data: converter.toORTB({
        bidRequests,
        bidderRequest
      })
    }
  },

  interpretResponse(serverResponse, bidRequest) {
    const bids = converter.fromORTB({response: serverResponse.body, request: bidRequest.data}).bids;
    return bids;
  }
};

registerBidder(spec);
