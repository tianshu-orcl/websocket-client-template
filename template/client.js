import { File } from '@asyncapi/generator-react-sdk';

function getDataProcessingBlock (msgType) {
  if (msgType == "array") {
    return ` 
        for (var i = 0; i < records.length; i++) {
	    console.log(records[i]);
            //data processing, implement user logic here. 
        }
    `;
  }
  else {
    return ` 
        console.log(records);
        //data processing, implement user logic here. 
    `;	
  }
}

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

  let dataProcessBlock = getDataProcessingBlock(msgType);
  
  return (
    <File name="streamingClient.js">
      {`
//////////////////////////////////////////////////////////////////////
//
// ${asyncapi.info().title()} - ${asyncapi.info().version()}
// ${urlProtocol} protocol: 
// ${urlServer} 
// ${urlPath}
//////////////////////////////////////////////////////////////////////
const WebSocket = require('ws')

//////////////////////////////////////////////////////////////////////
//
// This client demonstrates the one-way websocket streaming use case
// -- It assumes only one channel in the server!
// -- It assumes only 'subscribe' oepration in the channel!
// -- It supports query parameters such as ?begin=now&format=json
//
//////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////
//
// generic data processing with the websocket service,
// assume an array of json objects.
//
////////////////////////////////////////////////////////////////
const ${userFunction} = (wsClient) => {
    wsClient.on('message', function message(data) {
        console.log('received some data:')
        const records = eval(data.toString())
`+
 dataProcessBlock
 +
      `    
    });
    wsClient.on('error', (err) => {
        console.log(err.toString());
    });
}

////////////////////////////////////////////////////////////////
//
// main entry point for the example client:
// asyncapi yaml definition is parsed to provide service
// access URL and a dedicated websocket connection is
// created to stream data from the service.
//
////////////////////////////////////////////////////////////////

const init = async () =>{
    const serviceURL = '${urlProtocol}://${urlServer}${urlPath}${urlQueryString}'

    console.log(" ");
    console.log("Establishing websocket connection to: ");
    console.log(serviceURL);
    console.log(" ");

    // establishing websocket connection to the service
    const wsClient = new WebSocket(serviceURL);

    console.log(" ");
    console.log("Start streaming data from the service ...");
    console.log(" ");

    // now start the client processing    
    ${userFunction} (wsClient)
}

init()

      `}
    </File>
  );
}
