chrome.action.onClicked.addListener(async(tab)=>{await chrome.sidePanel.open({windowId:tab.windowId});});
chrome.runtime.onInstalled.addListener(()=>{void chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});});
