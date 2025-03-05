import "dotenv/config"
import { exit } from "process"
import { readFile } from "fs/promises"

import { queryFeatures } from "@esri/arcgis-rest-feature-service"
import { request, ArcGISIdentityManager } from "@esri/arcgis-rest-request"
import { createItem, searchItems, removeItem, setItemAccess } from "@esri/arcgis-rest-portal"

// create a new authentication manager from the username and password stored in the .env file
const username = process.env.USERNAME
const password = process.env.PASSWORD

if (!username || !password) {
  throw new Error("Username and password are required")
}

const authentication = await ArcGISIdentityManager.signIn({
  username,
  password,
})

const user = await authentication.getUser()
console.log(`Logged in as ${user.username}`)

// check that items with the title "Palm Springs Places" and delete them if they exist
// this is for this demo to make sure it can be re-run continuously
console.log("\nChecking for existing items...")

const existingItems = await searchItems({
  q: `title:"Palm Springs Places" AND owner:"${authentication.username}"`,
  authentication,
})

if (existingItems.results.length > 0) {
  await Promise.all([
    existingItems.results.map(({ id, title, type }) => {
      console.log(`Deleting ${type} ${id} with title ${title}`)
      return removeItem({ id, authentication })
    }),
  ])

  // wait for 1 second to allow time for the items to be deleted
  await new Promise(r => setTimeout(r, 2000))

  console.log(`Deleted ${existingItems.results.length} existing items`)
} else {
  console.log("No existing items found")
}

// next upload the CSV file and create an item
const rawData = await readFile("./batch-geocode/palm-springs-places.csv")
const someBlob = new Blob([rawData])

const item = await createItem({
  item: {
    title: "Palm Springs Places",
    type: "CSV",
    file: someBlob,
  },
  authentication,
})
console.log("\nCreated item", item.id)

// analyze the CSV file to determine the schema and get the publish parameters to publish the service
const analyzeResult = await request(`${authentication.portal}/content/features/analyze`, {
  authentication,
  params: {
    itemId: item.id,
    filetype: "csv",
    analyzeParameters: {
      enableGlobalGeocoding: true,
      sourceLocale: "en",
      returnEstimatedRowCount: true,
      returnSize: true,
      fieldTypesVersion: "V2",
      geocodeServiceUrl: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer",
      sourceCountryHint: "us",
      sourceCountry: "",
    },
  },
})
console.log("\nItem analyzed", analyzeResult.publishParameters)
analyzeResult.publishParameters.name = `Palm Springs Places_${new Date().getTime()}`

const publishResponse = await request(`${authentication.portal}/content/users/${authentication.username}/publish`, {
  authentication,
  params: {
    itemId: item.id,
    filetype: "csv",
    publishParameters: analyzeResult.publishParameters,
  },
})
console.log("\nItem published", publishResponse)

// allow time for the service to be spun up
await new Promise(r => setTimeout(r, 3000))

// https://developers.arcgis.com/arcgis-rest-js/api-reference/arcgis-rest-feature-service/IQueryFeaturesOptions/#Properties
const queryResponse = await queryFeatures({
  authentication,
  url: `${publishResponse.services[0].serviceurl}/0`,
  where: "1=1",
  returnCountOnly: true,
})
console.log(`\nQuery new service: ${queryResponse.count} features returned`)

if (user.userLicenseTypeId.startsWith("location")) {
  console.log("Sharing publicly not available for ArcGIS Location Platform accounts")
  console.log(`\nView item https://www.arcgis.com/home/item.html?id=${publishResponse.services[0].serviceItemId}`)
  exit(0)
}

const sharingResponses = await Promise.all(
  publishResponse.services.map(service => {
    return setItemAccess({
      id: service.serviceItemId,
      access: "public",
      authentication,
    })
  })
)
console.log("\nSharing item publicly", sharingResponses)

console.log(`\nView item https://www.arcgis.com/home/item.html?id=${sharingResponses[0].itemId}`)
