// main.js — browser entry point.
//
// Fetches the dribdat datapackage for GovTechHack26, builds an in-memory
// knowledge graph with @foerderfunke/sem-ops-utils (resources[1] = projects
// -> schema:Project nodes), serialises it to Turtle, and renders the projects
// as a simple table. The serialised Turtle is also offered as a download.

import { newStore, addTriple, storeToTurtle, prefixes, a } from "@foerderfunke/sem-ops-utils/core"
import { sparqlSelect } from "@foerderfunke/sem-ops-utils/sparql"

const API = "https://govtech.digisus-lab.ch/api/event/2/datapackage.json"
const SCHEMA = prefixes.schema // http://schema.org/
const TYPE = a.value
const PROJECT_BASE = "https://govtech.digisus-lab.ch/project/"

// Build the knowledge graph: one schema:Project per project resource.
function buildStore(datapackage) {
    const projects = datapackage?.resources?.[1]?.data ?? []
    const store = newStore()
    for (const p of projects) {
        if (p.id == null) continue
        const subject = `${PROJECT_BASE}${p.id}`
        addTriple(store, subject, TYPE, `${SCHEMA}Project`)
        addTriple(store, subject, `${SCHEMA}identifier`, String(p.id))
        if (p.name) addTriple(store, subject, `${SCHEMA}name`, p.name)
        if (p.url) addTriple(store, subject, `${SCHEMA}url`, p.url)
    }
    return store
}

async function extractProjectsFromStore(store) {
    const query = `
        PREFIX schema: <${SCHEMA}>
        SELECT ?id ?name ?url WHERE {
            ?project a schema:Project .
            OPTIONAL { ?project schema:identifier ?id }
            OPTIONAL { ?project schema:name ?name }
            OPTIONAL { ?project schema:url ?url }
        }
        ORDER BY ?id`
    return await sparqlSelect(query, [store])
}

function renderTable(projects) {
    const tbody = document.querySelector("#projects tbody")
    tbody.innerHTML = ""
    for (const p of projects) {
        const tr = document.createElement("tr")

        const idTd = document.createElement("td")
        idTd.textContent = p.id ?? ""
        tr.appendChild(idTd)

        const nameTd = document.createElement("td")
        nameTd.textContent = p.name ?? ""
        tr.appendChild(nameTd)

        const urlTd = document.createElement("td")
        if (p.url) {
            const link = document.createElement("a")
            link.href = p.url
            link.textContent = p.url
            link.target = "_blank"
            link.rel = "noopener"
            urlTd.appendChild(link)
        }
        tr.appendChild(urlTd)

        tbody.appendChild(tr)
    }
}

function offerTurtleDownload(turtle) {
    const link = document.getElementById("download")
    if (!link) return
    const blob = new Blob([turtle], { type: "text/turtle" })
    link.href = URL.createObjectURL(blob)
    link.download = "data.ttl"
    link.hidden = false
}

async function main() {
    const status = document.getElementById("status")
    try {
        const res = await fetch(API)
        if (!res.ok) throw new Error(`API returned HTTP ${res.status}`)
        const datapackage = await res.json()

        const store = buildStore(datapackage)
        const projects = await extractProjectsFromStore(store)

        renderTable(projects)
        offerTurtleDownload(await storeToTurtle(store))
        status.textContent = `${projects.length} projects — knowledge graph built from the dribdat API`
    } catch (err) {
        status.textContent = `Failed to build knowledge graph: ${err.message}`
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main)
} else {
    main()
}
