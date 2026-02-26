import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const createVMTool = createTool({
    id: "create_vm",
    description: "Create a new virtual machine in Azure.",
    inputSchema: z.object({
        name: z.string().describe("The name of the virtual machine"),
        image: z.string().describe("The OS image for the VM (e.g., 'Ubuntu', 'Windows')"),
        size: z.string().describe("The size of the VM (e.g., 'Standard_DS1_v2')"),
    }),
    requireApproval: true,
    execute: async (input) => {
        console.log(`Creating VM: ${input.name} with image ${input.image} and size ${input.size}`);
        return {
            status: "success",
            message: `VM ${input.name} created successfully.`,
            vmId: `vm-${Math.random().toString(36).substr(2, 9)}`,
        };
    },
});

export const updateVMTool = createTool({
    id: "update_vm",
    description: "Update an existing virtual machine's configuration in Azure.",
    inputSchema: z.object({
        name: z.string().describe("The name of the virtual machine to update"),
        size: z.string().describe("The new size for the VM"),
    }),
    requireApproval: true,
    execute: async (input) => {
        console.log(`Updating VM: ${input.name} to size ${input.size}`);
        return {
            status: "success",
            message: `VM ${input.name} updated to size ${input.size} successfully.`,
        };
    },
});

export const deleteVMTool = createTool({
    id: "delete_vm",
    description: "Delete a virtual machine in Azure.",
    inputSchema: z.object({
        name: z.string().describe("The name of the virtual machine to delete"),
    }),
    requireApproval: true,
    execute: async (input) => {
        console.log(`Deleting VM: ${input.name}`);
        return {
            status: "success",
            message: `VM ${input.name} deleted successfully.`,
        };
    },
});
