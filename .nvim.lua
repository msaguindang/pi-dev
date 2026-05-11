vim.api.nvim_create_autocmd("LspAttach", {
	callback = function(args)
		vim.lsp.stop_client(args.data.client_id)
	end,
})
