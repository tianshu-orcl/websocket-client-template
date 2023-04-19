import { File } from '@asyncapi/generator-react-sdk';

function getDataProcessingBlock (msgType) {
  if (msgType === "array") {
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

function getUserInputBlock (isSecure, isBasicAuth) {
  if (isSecure) {
    if (isBasicAuth) {
      throw new Error('basic authentication is not supported for wss protocol');
    }
    return ` 
    //Note: The following commands can be used to extract key/cert from your wallet.
    //   openssl pkcs12 -in <path_to_wallet>/ewallet.p12  -nokeys  -out <file_name>.crt -nodes  
    //   openssl pkcs12 -in <path_to_wallet>/ewallet.p12  -nocerts -out <file_name>.rsa -nodes
    let userCert = reader.question("Enter location of the certificate(.crt): ");
    let userKey  = reader.question("Enter location of the key(.rsa): ");
    `;
  }
  else {
    if (isBasicAuth) {
      return `       
      `;
    }
    else {
      return ` 
    let username = reader.question("Enter the username for accessing the service: ");
    let password = reader.question("Enter the password for accessing the service: ",{ hideEchoBack: true });
    if (!username || !password) {
      throw new Error("username and password can not be empty");
    }
      `;
    }
  }
}

function getQueryParamBlock(queryMap) {
  let mapSize = queryMap.length;  
  let s1 ='const queryParams = new Map([';
  queryMap.forEach(function(value, key) {
    s1 += '[\''+key+'\',\''+value+'\']';
    mapSize--;
    if (mapSize) {
      s1+= ','
    }
  })
  s1+=']);';
    
  return s1+`\n
    const queryParamSign    = "?";
    const queryParamDelimit = "&";
    let queryParamSignAdded = false;
    let size                = queryParams.length;

    for (const [key, value] of queryParams) {
      let paramValue = reader.question("Enter the value for query parameter "+key+"(default="+value+"):") || value;

      if (!queryParamSignAdded) {
        serviceURL += queryParamSign;
        queryParamSignAdded = true;
      }
      serviceURL += key + "=" + paramValue;
      size--;
      if (size) {
        serviceURL += queryParamDelimit;
      }
    }
  `;
}

function getServiceUrlBlock (isSecure,isBasicAuth,urlProtocol,urlServer,urlPath) {
  if (isSecure) {
    return ` 
    let serviceURL = '`+urlProtocol+`://`+urlServer+urlPath+`';
    `
    ;
  }
  else {
    if (isBasicAuth) {	  
      return ` 
    let serviceURL = '`+urlProtocol+`://`+urlServer+urlPath+`';
      `;
    }
    else {
      return `
    let serviceURL = '`+urlProtocol+`://'+username+':'+password+'@`+urlServer+urlPath+`';
    `;
    }
  }
}

function getWebSocketConnectionBlock (isSecure) {
  if (isSecure) {
    return ` 
    // establishing secure websocket connection to the service
    const options = {
      key: fs.readFileSync(userKey),
      cert: fs.readFileSync(userCert),
      ca: fs.readFileSync(userCert)
     };
    const wsClient = new WebSocket(serviceURL,options);
    `;
  }
  else {
    return ` 
    // establishing websocket connection to the service
    const wsClient = new WebSocket(serviceURL);
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
  let userFunction        = "processData";
  let urlPath             = "";
  let msgType             = "";
  let isSecure            = false;
  let isBasicAuth         = false;
  let queryMap            = new Map();
    
  if (urlProtocol === "wss") {
    isSecure = true;
  }
    
  if (urlServer.includes("@")) {
    isBasicAuth = true;
  }
	
  if (channelIterator.length !== 1) {
    throw new Error('only one channel allowed per streaming endpoint');
  }
    
  for (const [channelName, channel] of channelIterator) {
    if (channel.hasPublish()) {
      throw new Error('publish operation not supported in streaming client');
    }

    urlPath = channelName;
    msgType = channel.subscribe().message().payload().type()
    userFunction = channel.subscribe().id();

    if (channel.hasBindings("ws")) {
      let ws_binding = channel.binding("ws");
      let queryParamSignAdded = false;	
      const bindingPropIterator = Object.entries(ws_binding["query"]["properties"]);

      for (const [propKey, propValue] of bindingPropIterator) {
        let sValue = propValue["default"];
        if (sValue) {
          queryMap.set(propKey, sValue);      
        }
        else {
          queryMap.set(propKey, '');      
        }
      }
    }
  }

  let dataProcessBlock = getDataProcessingBlock(msgType);
  let userInputBlock = getUserInputBlock(isSecure,isBasicAuth);
  let serviceUrlBlock = getServiceUrlBlock(isSecure,isBasicAuth,urlProtocol,urlServer,urlPath);
  let queryParamBlock = getQueryParamBlock(queryMap); 
  let websocketConnectionBlock = getWebSocketConnectionBlock(isSecure);
  
  return (
    <File name="client.js">
      {`//////////////////////////////////////////////////////////////////////
//
// ${asyncapi.info().title()} - ${asyncapi.info().version()}
// ${urlProtocol} protocol: 
// ${urlServer} 
// ${urlPath}
//////////////////////////////////////////////////////////////////////
const WebSocket = require('ws')
const reader = require('readline-sync');
const fs = require('fs');

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
`+
 userInputBlock
 +
 serviceUrlBlock
 +
 queryParamBlock
 +
      `
    console.log(" ");
    console.log("Establishing websocket connection to: ");
    // uncomment below for debugging
    console.log(serviceURL); 
    console.log(" ");
`+
 websocketConnectionBlock
 +
      `
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
