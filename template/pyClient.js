import { File } from '@asyncapi/generator-react-sdk';

function getUserInputBlock (isSecure, isBasicAuth) {
  if (isSecure) {
    if (isBasicAuth) {
      throw new Error('basic authentication user:passwd@ is not supported for wss protocol');
    }
    return `    ##
    ## Note: The following commands can be used to extract pem file from the wallet.
    ##  openssl pkcs12 -in <path_to_wallet>/ewallet.p12 -clcerts -nokeys -out <file_name>.crt
    ##  openssl pkcs12 -in <path_to_wallet>/ewallet.p12 -nocerts -nodes  -out <file_name>.rsa
    ##  openssl pkcs12 -in <path_to_wallet>/ewallet.p12 -cacerts -nokeys -chain -out <file_name>.crt
    userCert = os.environ.get("ASYNCAPI_WS_CLIENT_CERT")
    if not userCert:
        userCert = input("Enter location of the client certificate: ")
    userKey = os.environ.get("ASYNCAPI_WS_CLIENT_KEY")
    if not userKey:
        userKey = input("Enter location of the private key: ")
    caCert = os.environ.get("ASYNCAPI_WS_CA_CERT")
    if not caCert:
        caCert = input("Enter location of the CA certificate: ")
    `;
  }
  else {
    if (isBasicAuth) {
      return ``;
    }
    else {
      return `    username = os.environ.get("ASYNCAPI_WS_CLIENT_USERNAME")
    if not username:
        username = input("Enter the username for accessing the service: ")
    password = os.environ.get("ASYNCAPI_WS_CLIENT_PASSWORD")
    if not password:
        password = getpass.getpass(prompt="Enter the password for accessing the service: ")
    if not username or not password :
      raise ValueError("username and password can not be empty")
      `;
    }
  }
}

function getQueryParamBlock(queryMap) {
  let s1 ='\n    queryParamsDefault = {}\n';
  queryMap.forEach(function(value, key) {
    s1 += '    queryParamsDefault[\''+key+'\'] = \''+value+'\'\n';
  })
    
  return s1+`\n
    queryParamSign      = '?'
    queryParamDelimit   = '&'
    queryParamSignAdded = False
    size                = len(queryParamsDefault)

    for key in queryParamsDefault.keys():
      prompt = "Enter value for query parameter "+key+"(default="+queryParamsDefault[key]+"):"
      paramValue = input(prompt) or queryParamsDefault[key];

      if not queryParamSignAdded:
        serviceURL += queryParamSign
        queryParamSignAdded = True
      serviceURL += key + "=" + paramValue
      size=size-1
      if size:
        serviceURL += queryParamDelimit
  `;
}

function getServiceUrlBlock (isSecure,isBasicAuth,urlProtocol,urlServer,urlPath) {
  if (isSecure) {
    return ` 
    # construct service URL
    serviceURL = '`+urlProtocol+`://`+urlServer+urlPath+`'
    `
    ;
  }
  else {
    if (isBasicAuth) {	  
      return ` 
    # construct service URL
    serviceURL = '`+urlProtocol+`://`+urlServer+urlPath+`'
      `;
    }
    else {
      return `
    # construct service URL
    serviceURL = '`+urlProtocol+`://'+username+':'+password+'@`+urlServer+urlPath+`'
    `;
    }
  }
}

function getWebSocketConnectionBlock (isSecure) {
  if (isSecure) {
    return ` 
    ## establishing secure websocket connection to the service
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ssl_context.load_verify_locations(caCert)
    ssl_context.load_cert_chain(userCert, userKey)

    async with websockets.connect(serviceURL, ssl=ssl_context) as websocket:`;
  }
  else {
    return ` 
    ## establishing websocket connection to the service
    async with websockets.connect(serviceURL) as websocket:`;
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
    userFunction = channel.subscribe().id();

    if (channel.hasBindings("ws")) {
      let ws_binding = channel.binding("ws");
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
    
  let userInputBlock = getUserInputBlock(isSecure,isBasicAuth);
  let serviceUrlBlock = getServiceUrlBlock(isSecure,isBasicAuth,urlProtocol,urlServer,urlPath);
  let queryParamBlock = getQueryParamBlock(queryMap); 
  let websocketConnectionBlock = getWebSocketConnectionBlock(isSecure);
     
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
import ssl
import pathlib
import getpass
import os

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
    ## take user input
`+
 userInputBlock
 +
 serviceUrlBlock
 +
 queryParamBlock
 +
`   
    # uncomment below for debugging
    #print(serviceURL)    
`
 +
 websocketConnectionBlock      
 +`
        print("start streaming data from the service")
        while True:
            data = await websocket.recv()
            records = json.loads(data)
            count = len(records)
            print(f"< received {count} records")
            for rec in records:
                #
                # implement client side data processing logic here
                #
                print(f"< {rec}")

asyncio.run(${userFunction}())
      `}
    </File>
  );
}
