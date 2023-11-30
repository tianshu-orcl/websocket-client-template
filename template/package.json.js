import { File } from '@asyncapi/generator-react-sdk';

export default function({ asyncapi, params }) {
  let jsonString =
`{ 
  "name": "${asyncapi.info().title()}",
  "description": "${asyncapi.info().description()}",
  "version": "${asyncapi.info().version()}",
  "dependencies": {
    "readline-sync": "^1.4.10"
  }
}`;

  return (
    <File name="package.json">
      {
	//remove newline to avoid invalid json format
        jsonString.replace(/(\r\n|\n|\r)/g,"")
      }
    </File>
  );
}
