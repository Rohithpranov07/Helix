/**
 * Railway GraphQL API client.
 *
 * Schema verified via live curl calls against https://backboard.railway.app/graphql/v2
 * before implementation. All field names and types match confirmed responses.
 *
 * Token: process.env.RAILWAY_API_TOKEN (never logged, never committed).
 */

const RAILWAY_GQL = "https://backboard.railway.app/graphql/v2";

function token(): string {
  const t = process.env.RAILWAY_API_TOKEN;
  if (!t) throw new Error("RAILWAY_API_TOKEN is not set in environment");
  return t;
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(RAILWAY_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Railway API HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Railway GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Railway API returned no data");
  return json.data;
}

export interface RailwayProject {
  id: string;
  name: string;
}

export interface RailwayDeployment {
  id: string;
  status: string;
  createdAt: string;
  service: { id: string; name: string } | null;
}

export interface RailwayLogEntry {
  message: string;
  timestamp: string;
}

export async function fetchProjects(): Promise<RailwayProject[]> {
  const data = await gql<{
    projects: { edges: Array<{ node: { id: string; name: string } }> };
  }>(`
    query {
      projects {
        edges {
          node { id name }
        }
      }
    }
  `);
  return data.projects.edges.map((e) => ({ id: e.node.id, name: e.node.name }));
}

export async function fetchDeployments(
  projectId: string,
  limit = 10,
): Promise<RailwayDeployment[]> {
  const data = await gql<{
    deployments: {
      edges: Array<{
        node: {
          id: string;
          status: string;
          createdAt: string;
          service: { id: string; name: string } | null;
        };
      }>;
    };
  }>(
    `
    query($projectId: String!, $limit: Int!) {
      deployments(input: { projectId: $projectId }, first: $limit) {
        edges {
          node {
            id
            status
            createdAt
            service { id name }
          }
        }
      }
    }
  `,
    { projectId, limit },
  );
  return data.deployments.edges.map((e) => ({
    id: e.node.id,
    status: e.node.status,
    createdAt: e.node.createdAt,
    service: e.node.service,
  }));
}

export async function fetchBuildLogs(
  deploymentId: string,
  limit = 100,
): Promise<RailwayLogEntry[]> {
  const data = await gql<{
    buildLogs: Array<{ message: string; timestamp: string }>;
  }>(
    `
    query($deploymentId: String!, $limit: Int!) {
      buildLogs(deploymentId: $deploymentId, limit: $limit) {
        message
        timestamp
      }
    }
  `,
    { deploymentId, limit },
  );
  return data.buildLogs ?? [];
}

export async function fetchDeploymentLogs(
  deploymentId: string,
  limit = 100,
): Promise<RailwayLogEntry[]> {
  const data = await gql<{
    deploymentLogs: Array<{ message: string; timestamp: string }>;
  }>(
    `
    query($deploymentId: String!, $limit: Int!) {
      deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
        message
        timestamp
      }
    }
  `,
    { deploymentId, limit },
  );
  return data.deploymentLogs ?? [];
}

export async function findLatestFailedDeployment(
  projectId: string,
): Promise<RailwayDeployment | null> {
  const deployments = await fetchDeployments(projectId, 20);
  return (
    deployments.find((d) =>
      ["FAILED", "CRASHED"].includes(d.status),
    ) ?? null
  );
}
