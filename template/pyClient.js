import { File } from '@asyncapi/generator-react-sdk';

export default function({ asyncapi, params }) {
  if (!asyncapi.hasComponents()) {
    return null;
  }
  if (!asyncapi.hasChannels()) {
    return null;
  }

  const urlProtocol       = asyncapi.server(params.server).protocol();
  const urlServer         = asyncapi.server(params.server).url();
  const channels          = asyncapi.channels();
  const channelIterator   = Object.entries(channels);
  const queryParamSign    = "?";
  const queryParamDelimit = "&";
  let userFunction        = "processData";
  let urlPath             = "";
  let urlQueryString      = "";
  let msgType             = "";
 
  if (channelIterator.length !== 1) {
    throw new Error('only one channel allowed per streaming endpoint');
  }
    
  for (const [channelName, channel] of channelIterator) {
    if (channel.hasPublish()) {
      throw new Error('publish operation not supported in streaming client');
    }

    urlPath = channelName;
    const channelParameterEntries = Object.entries(channel.parameters());
    msgType = channel.subscribe().message().payload().type()
    userFunction = channel.subscribe().id();

    if (channel.hasBindings("ws")) {
      let ws_binding = channel.binding("ws");
      let queryParamSignAdded = false;	
      const bindingPropIterator = Object.entries(ws_binding["query"]["properties"]);
      let bindingPropSize = bindingPropIterator.length;	

      for (const [propKey, propValue] of bindingPropIterator) {
        let sValue = propValue["default"];
	if (sValue) {
          if (!queryParamSignAdded) {
            urlQueryString += queryParamSign;
            queryParamSignAdded = true;
	  }
	    urlQueryString += propKey + "=" + sValue;
            bindingPropSize--;
            if (bindingPropSize !== 0) {
		urlQueryString += queryParamDelimit;
	    }  
	}
      }
    }
  }
    
  return (
    <File name="client.py">
      {`#!/usr/bin/env python
###############################################################################
#
# ${asyncapi.info().title()} - ${asyncapi.info().version()}
# ${urlProtocol} protocol: 
# ${urlServer} 
# ${urlPath}
###############################################################################

import asyncio
import websockets
import json

###############################################################################
#
# This client demonstrates the one-way websocket streaming use case
# -- It assumes only one channel in the server!
# -- It assumes only 'subscribe' oepration in the channel!
# -- It supports query parameters such as ?begin=now&format=json
#
###############################################################################

###############################################################################
#
# main entry point for the example client:
# asyncapi yaml definition is parsed to provide service
# access URL and a dedicated websocket connection is
# created to stream data from the service.
#
###############################################################################
async def ${userFunction}():
        # construct service URL
        uri = "${urlProtocol}://${urlServer}${urlPath}${urlQueryString}";

        # establish websocket connection
        async with websockets.connect(uri) as websocket:
            print("start streaming data from the service")
            while True:
                data = await websocket.recv()
                records = json.loads(data)
                count = len(records)
                print(f"< received {count} records")
                for rec in records:
                    #
                    # implement data processing logic here
                    #
                    optype = rec['op_type']
                    if 'pos' in rec:
                        position = rec['pos']
                        print(f"< type: {optype} pos: {position}")
                    else:
                        print(f"< type: {optype}")
                    print(f"< {rec}")

asyncio.run(${userFunction}())
      `}
    </File>
  );
}
