import "dotenv/config"
import { ArcGISIdentityManager } from "@esri/arcgis-rest-request"
import {
  createFeatureService,
  addToServiceDefinition,
} from "@esri/arcgis-rest-feature-service"
import { searchItems, removeItem } from "@esri/arcgis-rest-portal"

// Authenticate with an API key
const accessToken = process.env.ACCESS_TOKEN
const serviceName = process.env.FEATURE_SERVICE_NAME

if (!accessToken) {
  throw new Error("An access token is required")
}

const getIdentity = async () => {
  return await ArcGISIdentityManager.fromToken({
    token: accessToken,
  })
}

const removeItems = async (authentication) => {
  // check for existing items and delete them if they exist
  // this is for this demo to make sure it can be re-run continuously
  console.log("\nChecking for existing items")

  const existingItems = await searchItems({
    q: `title:${serviceName} AND owner:"${authentication.username}"`,
    authentication,
  })

  if (existingItems.results.length > 0) {
    await Promise.all([
      existingItems.results.map(({ id, title, type }) => {
        console.log(`Deleting ${type} ${id} with title ${title}`)
        return removeItem({ id, authentication })
      }),
    ])

    // wait to allow time for the items to be deleted
    await new Promise((r) => setTimeout(r, 2000))

    console.log(`Deleted ${existingItems.results.length} existing items`)
  } else {
    console.log("No existing items found")
  }
}

const createNewService = async () => {
  // login to the portal
  console.log("Logging in...")
  const auth = await getIdentity()
  console.log(`\tSigned in as ${auth.username}`)
  await removeItems(auth)

  // define layer schema
  const layerSchema = [
    {
      name: serviceName,
      type: "Feature Layer",
      defaultVisibility: true,
      isDataVersioned: false,
      supportsRollbackOnFailureParameter: true,
      supportsAdvancedQueries: false,
      geometryType: "esriGeometryPoint",
      minScale: 0,
      maxScale: 0,
      extent: {
        spatialReference: {
          wkid: 4326,
        },
        xmin: -118.84764718980026,
        ymin: 33.99799168307417,
        xmax: -118.7618165013238,
        ymax: 34.026450333167524,
      },
      drawingInfo: {
        transparency: 0,
        labelingInfo: null,
        renderer: {
          type: "simple",
          symbol: {
            color: [20, 158, 206, 130],
            size: 18,
            angle: 0,
            xoffset: 0,
            yoffset: 0,
            type: "esriSMS",
            style: "esriSMSCircle",
            outline: {
              color: [255, 255, 255, 220],
              width: 2.25,
              type: "esriSLS",
              style: "esriSLSSolid",
            },
          },
        },
      },
      allowGeometryUpdates: true,
      hasAttachments: true,
      htmlPopupType: "esriServerHTMLPopupTypeNone",
      hasM: false,
      hasZ: false,
      objectIdField: "OBJECTID",
      fields: [
        {
          name: "OBJECTID",
          type: "esriFieldTypeOID",
          alias: "OBJECTID",
          sqlType: "sqlTypeOther",
          nullable: false,
          editable: false,
          domain: null,
          defaultValue: null,
        },
        {
          name: "id",
          type: "esriFieldTypeInteger",
          alias: "id",
          sqlType: "sqlTypeInteger",
          nullable: true,
          editable: true,
          domain: null,
          defaultValue: null,
        },
        {
          name: "name",
          type: "esriFieldTypeString",
          alias: "name",
          sqlType: "sqlTypeNVarchar",
          nullable: true,
          editable: true,
          domain: null,
          defaultValue: null,
          length: 256,
        },
        {
          name: "rating",
          type: "esriFieldTypeString",
          alias: "rating",
          sqlType: "sqlTypeNVarchar",
          nullable: true,
          editable: true,
          domain: null,
          defaultValue: null,
          length: 256,
        },
      ],
      templates: [
        {
          name: "New Feature",
          description: "",
          drawingTool: "esriFeatureEditToolPoint",
          prototype: {
            attributes: {
              id: null,
              name: null,
              rating: null,
            },
          },
        },
      ],
      supportedQueryFormats: "JSON",
      hasStaticData: true,
      maxRecordCount: 10000,
      capabilities: "Query,Extract",
    },
  ]

  console.log("\nCreating new service...")
  // create the service
  const newService = await createFeatureService({
    authentication: auth,
    item: {
      name: serviceName,
      capabilities: "Query, Extract",
      description:
        "Programmatically generated feature service using ArcGIS REST JS",
      units: "esriMeters",
      initialExtent: {
        xmin: -134.74729261792592,
        ymin: 23.56096242376989,
        xmax: -55.695547615409396,
        ymax: 50.309217030288835,
        spatialReference: { wkid: 4326 },
      },
      spatialReference: { wkid: 4326 },
    },
  })
  console.log("\t")

  console.log("\nAdding schema to new service...")
  // create layer
  const newFeatureLayer = await addToServiceDefinition(newService.serviceurl, {
    authentication: auth,
    layers: layerSchema,
  })

  console.log(
    `\nNew item and service created:\nid: https://www.arcgis.com/home/item.html?id=${newService.itemId}&token=${auth.token}\nurl:${newService.serviceurl}/0/?token=${auth.token}`
  )
}

createNewService()
