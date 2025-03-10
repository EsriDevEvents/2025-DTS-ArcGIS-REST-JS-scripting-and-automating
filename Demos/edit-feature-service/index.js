import "dotenv/config"
import { ArcGISIdentityManager } from "@esri/arcgis-rest-request"
import { addFeatures, deleteFeatures } from "@esri/arcgis-rest-feature-service"
import { getItemData, getItem, searchItems } from "@esri/arcgis-rest-portal"

// Authenticate
const authentication = await ArcGISIdentityManager.fromToken({
  token: process.env.ACCESS_TOKEN,
})
console.log(`logged in as ${authentication.username}`)

// search for item based on its name and owner
const searchResponse = await searchItems({
  q: `title:"${process.env.FEATURE_SERVICE_NAME}" AND owner:"${authentication.username}"`,
  authentication,
})
// Get the item from the search response, in this case it'll be the first one
const item = searchResponse.results[0]

// Check that the item is a feature service, Get also get the feature service directly by its itemID using getItem
// const item = await getItem(item.id, { authentication })
if (!item & (item.type !== "Feature Service")) {
  console.log("Item is not a feature service")
  exit(0)
}
const fsURL = `${item.url}/0`

// remove any existing features (from previous imports)
const delResponse = await deleteFeatures({
  url: fsURL,
  where: "1=1",
  authentication,
})
console.log(`${delResponse.deleteResults.length} old features removed`)

// Used for generating a random lat/lng
// from https://stackoverflow.com/a/6878845
const getRandomInRange = (from, to, fixed) => {
  return (Math.random() * (to - from) + from).toFixed(fixed) * 1
}

const getRandomRating = () => {
  const sampleRatings = ["Great", "Awesome", "Excellent", "Unbelievable", "Wow"]
  return sampleRatings[Math.floor(Math.random() * sampleRatings.length)]
}

// generate some random features

const newFeatures = []
for (let i = 0; i < 100; i++) {
  newFeatures.push({
    attributes: {
      id: i,
      name: `New feature #${i + 1}`,
      rating: getRandomRating(),
    },
    geometry: {
      x: getRandomInRange(-116.57, -116.5, 3),
      y: getRandomInRange(33.8, 33.84, 3),
      spatialReference: { wkid: 4326 },
    },
  })
}

// Send the new features to the service
const addResponse = await addFeatures({
  url: fsURL,
  features: newFeatures,
  authentication,
})
console.log(
  `${addResponse.addResults.length} new features added\nview in map https://www.arcgis.com/apps/mapviewer/index.html?url=${fsURL}&source=sd&token=${authentication.token}`
)
